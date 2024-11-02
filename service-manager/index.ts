import config from "./config.json";
import downloaderURLs from "./downloaders.json";
import socketClosureCodes from "./socket_closure_codes.json";
import { DEFAULT_CLIENT_SETTINGS } from "./defaults";
import { sleep, type ServerWebSocket } from "bun";
import {
	createClientboundPacket,
	createDownloaderboundPacket,
	isServerboundClientPacketOfType,
	isServerboundDownloaderPacketOfType
} from "./packets";

import { clients, downloaders, jobs, queue, sessionRecoveryTimeouts } from "./storage";
import settingsUpdateC2SHandler from "./packet-handlers/c2s/settings-update";
import jobCreateC2SHandler from "./packet-handlers/c2s/job-create";
import packageRequestC2SHandler from "./packet-handlers/c2s/package-request";
import pingDownloadersC2SHandler from "./packet-handlers/c2s/ping-downloaders";
import queueRemoveC2SHandler from "./packet-handlers/c2s/queue-remove";
import restartDownloadersRequestC2SHandler from "./packet-handlers/c2s/restart-downloaders-request";
import startConfirmD2SHandler from "./packet-handlers/d2s/start-confirm";
import startRejectD2SHandler from "./packet-handlers/d2s/start-reject";
import statusD2SHandler from "./packet-handlers/d2s/status";
import finishD2SHandler from "./packet-handlers/d2s/finish";
import failD2SHandler from "./packet-handlers/d2s/fail";
import dataD2SHandler from "./packet-handlers/d2s/data";

import path from "node:path";
import { unlink, rm, readdir, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import archiver from "archiver";

import type {
	ClientSocketData,
	DownloaderListS2CPacket,
	DownloaderSocketData,
	DownloadFailD2SPacket,
	DownloadFinishD2SPacket,
	DownloadStartConfirmD2SPacket,
	DownloadStartRejectD2SPacket,
	DownloadStartS2DPacket,
	DownloadStatusD2SPacket,
	InitS2DPacket,
	JobCreateC2SPacket,
	JobDownloadFailS2CPacket,
	JobDownloadPendingS2CPacket,
	PackageEndS2CPacket,
	PackageFailS2CPacket,
	PackageRequestC2SPacket,
	PackageStartPacket,
	PingDownloadersC2SPacket,
	PingS2CPacket,
	QueueRemoveC2SPacket,
	QueueUpdateS2CPacket,
	RecoveredJobListS2CPacket,
	RestartDownloadersRequestC2SPacket,
	ServerboundClientPacketIdentifier,
	ServerboundDownloaderPacketIdentifier,
	SettingsUpdateC2SPacket,
	UUID,
	WelcomeS2CPacket
} from "../common/types";

export const patterns = {
	videoId: /^[A-Za-z\-_0-9]{11}$/,
	uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
	protocolDownloaderKey: /^key\.[a-z]{32}$/,
	protocolSessionRecovery: /^session\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
	protocolContactURL: /^contact\..*$/,
	windowsReservedNames: /^(con|prn|aux|nul|com1|com2|com3|com4|com5|com6|com7|com8|com9|lpt1|lpt2|lpt3|lpt4|lpt5|lpt6|lpt7|lpt8|lpt9)/i,
	reservedSymbols: /[<>:"\/\\\|\?\*\.]/gi
};

async function initialize() {
	console.log("Initializing manager...");
	const { DOWNLOADER_CREATION_KEY } = process.env;
	if (!DOWNLOADER_CREATION_KEY) console.warn("No key set for downloaders to register!");

	for (const downloader of downloaderURLs) {
		fetch(downloader);
	}

	await mkdir(path.join(import.meta.dir, "downloads"), { recursive: true });

	const files = await readdir(path.join(import.meta.dir, "downloads"));
	for (const file of files) {
		const isDirectory = isUUID(file);
		try {
			if (isDirectory) await rm(path.join(import.meta.dir, "downloads", file), { recursive: true, force: true });
			else await unlink(path.join(import.meta.dir, "downloads", file));
		} catch (error) {
			console.error("Could not delete some pre-stored downloads", error);
		}
	}
}

initialize();

function parseSocketProtocols(request: Request) {
	const header = request.headers.get("Sec-WebSocket-Protocol");
	if (typeof header !== "string" || header.length > 127) return [];
	// The formatting defines comma seperation with a empty space after it.
	return header.split(",").map((element) => element.trim());
}

function isUUID(text: string): text is UUID {
	return patterns.uuid.test(text);
}

function setToTwoDigits(number: number) {
	return String(number).padStart(2, "0");
}

Bun.serve<ClientSocketData | DownloaderSocketData>({
	port: 4000,
	fetch(request, server) {
		const url = new URL(request.url);
		const pathname = url.pathname.substring(1);

		if (isUUID(pathname)) {
			const session = clients.get(pathname);
			if (session === undefined) return new Response("Unknown session to download", { status: 404 });
			if (session.data.packaging_status !== "done") return new Response("Cannot yet download file", { status: 403 });
			const filePath = path.join(import.meta.dir, "downloads", session.data.session_id + ".zip");
			const fileHandler = Bun.file(filePath);
			const now = new Date();
			const timeString = `${setToTwoDigits(now.getHours())}-${setToTwoDigits(now.getMinutes())}`;
			const dateString = `${setToTwoDigits(now.getDate())}-${setToTwoDigits(now.getMonth())}-${setToTwoDigits(now.getFullYear())}`;
			return new Response(fileHandler, {
				headers: {
					"Content-Disposition": `attachment; filename="Downloads at ${dateString} ${timeString}.zip"`
				}
			});
		}

		// The procotols are not intended to be used this way, but they
		// do provide a neat way of sending such information along.

		// The user provides the protocols we use for sending data as a key value pair
		// seperated by a dot. (The WebSocket constructor does not allow a = in the protocols)
		const protocols = parseSocketProtocols(request);
		const additionalConfig: { isDownloader: boolean; downloaderContactUrl: string | null; sessionRecoveryId: UUID | null } = {
			isDownloader: false,
			downloaderContactUrl: null,
			sessionRecoveryId: null
		};
		for (const protocol of protocols) {
			if (patterns.protocolDownloaderKey.test(protocol)) {
				if (protocol.substring(4) !== process.env.DOWNLOADER_CREATION_KEY) return new Response("Invalid downloader key", { status: 401 });
				additionalConfig.isDownloader = true;
			}
			// We'd assume the downloader already sent the downloader key as the first subprotocol
			else if (patterns.protocolContactURL.test(protocol) && additionalConfig.isDownloader) {
				additionalConfig.downloaderContactUrl = protocol.substring(8);
			} else if (patterns.protocolSessionRecovery.test(protocol)) additionalConfig.sessionRecoveryId = protocol.substring(8) as UUID;
		}

		const upgradeFailureResponse = new Response("Upgrade failed", { status: 500 });
		if (additionalConfig.isDownloader) {
			if (additionalConfig.downloaderContactUrl === null) return upgradeFailureResponse;
			const isConnectionUpgraded = server.upgrade<DownloaderSocketData>(request, {
				//headers: {
				// The Bun WS client implementation is happy if we send back the whole header.
				// OBVIOUSLY, subprotocols are not meant to be used this way, but it is by far the
				// easiest way to communicate information via the websocket constructor.
				//"Sec-WebSocket-Protocol": request.headers.get("Sec-WebSocket-Protocol") ?? ""
				//},
				data: {
					downloader_id: crypto.randomUUID(),
					type: "downloader",
					current_download: null,
					contact_url: additionalConfig.downloaderContactUrl
				}
			});
			if (isConnectionUpgraded) pushQueueIntoDownloaders();
			return isConnectionUpgraded ? undefined : upgradeFailureResponse;
		}

		if (clients.size >= config.maxClients) return upgradeFailureResponse;

		// Session recovery
		let sessionIdOverwrite: UUID | null = null;
		const sessionJobs: UUID[] = [];
		if (additionalConfig.sessionRecoveryId !== null) {
			const { sessionRecoveryId: id } = additionalConfig;
			if (sessionRecoveryTimeouts.has(id)) {
				const timeout = sessionRecoveryTimeouts.get(id);
				sessionRecoveryTimeouts.delete(id);
				clearTimeout(timeout);

				sessionIdOverwrite = id;
				for (const [jobId, job] of jobs) {
					if (job.session_id !== id) continue;
					job.paused = false;
					sessionJobs.push(jobId);
				}

				pushQueueIntoDownloaders();

				console.log("Recovered session", id);
			}
		}

		const isConnectionUpgraded = server.upgrade<ClientSocketData>(request, {
			data: {
				type: "client",
				session_id: sessionIdOverwrite ?? crypto.randomUUID(),
				settings: structuredClone(DEFAULT_CLIENT_SETTINGS),
				packaging_status: "none",
				jobs: sessionJobs,
				restored: sessionIdOverwrite !== null,
				pingIntervalId: null
			}
		});

		if (!isConnectionUpgraded) return upgradeFailureResponse;
	},
	websocket: {
		message: onSocketMessage,
		open: onSocketOpen,
		close: onSocketClose,
		// Some of our packets may be larger than the default of 16MB
		maxPayloadLength: 1024 * 1024 * 64
	}
});

/**
 * Whenever a client might disconnect and does not send a close frame, the server will not notice that the TCP
 * tunnel has been closed. Thus no close event is fired on the server and the session stays alive. If the user
 * then tries to restore the session, it will fail. To prevent this, we ping the client in short pulses.
 *
 * If a ping fails, the connection is closed and the close event is fired, thus saving the session and allowing a restore.
 */
function startClientPingInterval(ws: ServerWebSocket<ClientSocketData>) {
	return setInterval(() => {
		ws.send(createClientboundPacket<PingS2CPacket>("ping"));
	}, 5000);
}

function onSocketOpen(ws: ServerWebSocket<ClientSocketData | DownloaderSocketData>) {
	console.log("new " + ws.data.type, ws.data);
	if (!isClientSocket(ws)) {
		// TS won't automatically assume this!
		const downloaderSocket = ws as ServerWebSocket<DownloaderSocketData>;
		downloaders.set(downloaderSocket.data.downloader_id, downloaderSocket);
		ws.send(createDownloaderboundPacket<InitS2DPacket>("init", { maxAudioLength: config.maxAudioLength }));
		broadcastDownloaderList();
		return;
	}
	clients.set(ws.data.session_id, ws);
	ws.send(createClientboundPacket<WelcomeS2CPacket>("welcome", { session_id: ws.data.session_id, config }));
	broadcastDownloaderList(ws);
	if (ws.data.restored) {
		const ownedJobs = Array.from(jobs.values()).filter((job) => job.session_id === ws.data.session_id);
		ws.send(createClientboundPacket<RecoveredJobListS2CPacket>("recovered-job-list", { jobs: ownedJobs }));
	}
	ws.data.pingIntervalId = startClientPingInterval(ws);
}

function onSocketClose(ws: ServerWebSocket<ClientSocketData | DownloaderSocketData>, code: number, reason: string) {
	console.log(`Lost connection to ${ws.data.type} due to ${code} with reason ${reason}`);
	if (isClientSocket(ws)) {
		clearInterval(ws.data.pingIntervalId as Timer);
		// In other circumstances, the user's internet connection might have gotten lost,
		// they could have accidentially refreshed the page or been kicked from the service.
		// If the data is already packaged, we do not want to allow a restore (it'd be pointless to store the jobs).
		const shouldStoreSession = code !== socketClosureCodes.download_finished && ws.data.packaging_status === "none";
		if (!shouldStoreSession) {
			const deletionTime = new Date(Date.now() + config.downloadMinutes * 60 * 1000).toLocaleTimeString();
			console.log("Deleting session data for", ws.data.session_id, "at", deletionTime);
			// Ten minutes should be more than enough time to allow a user to download all their files
			scheduleSessionFilesForDeletion(ws, config.downloadMinutes * 60 * 1000);
			return;
		}
		console.log("Allowing session", ws.data.session_id, "to recover for", config.sessionRecoveryTimeout, "seconds");
		// After this timeout, files can be immediatly deleted, as there is no
		// way for that session to ever recover, nor has the user ever requested packaging.
		const timeout = setTimeout(() => scheduleSessionFilesForDeletion(ws, 0), config.sessionRecoveryTimeout * 1000);
		sessionRecoveryTimeouts.set(ws.data.session_id, timeout);
		return;
	}

	const socket = ws as ServerWebSocket<DownloaderSocketData>;
	downloaders.delete(socket.data.downloader_id);
	broadcastDownloaderList();

	if (socket.data.current_download === null) return;
	const job = jobs.get(socket.data.current_download);
	if (job === undefined) return;
	job.assigned_downloader = null;
	deleteJob(job.job_id);

	const client = clients.get(job.session_id);
	if (client === undefined) return;
	client.send(
		createClientboundPacket<JobDownloadFailS2CPacket>("job-download-fail", { job_id: job.job_id, reason: "Connection lost to downloader" })
	);
}

function broadcastDownloaderList(ws?: ServerWebSocket<ClientSocketData>) {
	const list = [];
	for (const [id, data] of downloaders) {
		// As all downloaders are hosted on a certain... platform, they get these names
		list.push({ id, name: data.data.contact_url.split(".")[0] });
	}
	const packet = createClientboundPacket<DownloaderListS2CPacket>("downloader-list", { downloaders: list });
	for (const client of ws ? [ws] : clients.values()) {
		if (client.readyState !== WebSocket.OPEN) continue;
		client.send(packet);
	}
}

async function scheduleSessionFilesForDeletion(ws: ServerWebSocket<ClientSocketData>, timeout: number) {
	await sleep(timeout);

	for (let i = ws.data.jobs.length - 1; i >= 0; i--) {
		let deleted = false;
		do {
			deleted = deleteJob(ws.data.jobs[i]);
			// If this download has not been finished, kindly wait for it to
			// finish and then all of it will get wiped.
			if (!deleted) await sleep(1000);
		} while (!deleted);
	}

	clients.delete(ws.data.session_id);
	const downloadPath = path.join(import.meta.dir, "downloads", ws.data.session_id);
	await unlink(downloadPath + ".zip").catch(() => void 0);
	await rm(downloadPath).catch(() => void 0);
	console.log("Deleted files for session", ws.data.session_id);
}

function handleMessageFromDownloader(ws: ServerWebSocket<DownloaderSocketData>, message: string | Buffer) {
	try {
		if (message instanceof Buffer) {
			console.log("Received binary packet with length", message.length);
			dataD2SHandler(ws, message);
			return;
		}
		const packet = JSON.parse(message) as { id: ServerboundDownloaderPacketIdentifier; data: any };
		if (isServerboundDownloaderPacketOfType<DownloadFailD2SPacket>(packet, "download-fail")) return failD2SHandler(ws, packet);
		if (isServerboundDownloaderPacketOfType<DownloadFinishD2SPacket>(packet, "download-finish")) return finishD2SHandler(ws, packet);
		if (isServerboundDownloaderPacketOfType<DownloadStartConfirmD2SPacket>(packet, "download-start-confirm"))
			return startConfirmD2SHandler(ws, packet);
		if (isServerboundDownloaderPacketOfType<DownloadStartRejectD2SPacket>(packet, "download-start-reject"))
			return startRejectD2SHandler(ws, packet);
		if (isServerboundDownloaderPacketOfType<DownloadStatusD2SPacket>(packet, "download-status")) return statusD2SHandler(ws, packet);
		throw new TypeError("Recieved an unknown packet from a downloader");
	} catch (error) {
		// This should not happen, as all packets from downloaders should be valid
		console.error(error);
	}
}

function isClientSocket(ws: ServerWebSocket<ClientSocketData | DownloaderSocketData>): ws is ServerWebSocket<ClientSocketData> {
	return ws.data.type !== "downloader";
}

function onSocketMessage(ws: ServerWebSocket<ClientSocketData | DownloaderSocketData>, message: string | Buffer): any {
	if (!isClientSocket(ws)) return handleMessageFromDownloader(ws as ServerWebSocket<DownloaderSocketData>, message);
	// This manager does not handle binary data
	if (typeof message !== "string") return ws.close(socketClosureCodes.invalid_data);

	// Downloaders do not get valdiated in the same way as clients do,
	// as we can "trust" them (they have used our secret key to be created)
	if (message.length > config.maxPacketLength) return ws.close(socketClosureCodes.message_too_large);

	try {
		const packet = JSON.parse(message) as { id: ServerboundClientPacketIdentifier; data: any };
		if (typeof packet !== "object" || Array.isArray(packet) || packet === null) throw new TypeError("Invalid type for packet");
		if (typeof packet.id !== "string") throw new ReferenceError("Invalid id for packet");
		if (typeof packet.data !== "object" || Array.isArray(packet.data) || packet.data === null)
			throw new TypeError("Invalid type for data field of packet");

		if (isServerboundClientPacketOfType<SettingsUpdateC2SPacket>(packet, "settings-update")) return settingsUpdateC2SHandler(ws, packet);
		if (isServerboundClientPacketOfType<JobCreateC2SPacket>(packet, "job-create")) return jobCreateC2SHandler(ws, packet);
		if (isServerboundClientPacketOfType<PackageRequestC2SPacket>(packet, "package-request")) return packageRequestC2SHandler(ws, packet);
		if (isServerboundClientPacketOfType<PingDownloadersC2SPacket>(packet, "ping-downloaders")) return pingDownloadersC2SHandler(ws, packet);
		if (isServerboundClientPacketOfType<QueueRemoveC2SPacket>(packet, "queue-remove")) return queueRemoveC2SHandler(ws, packet);
		if (isServerboundClientPacketOfType<RestartDownloadersRequestC2SPacket>(packet, "restart-downloaders-request"))
			return restartDownloadersRequestC2SHandler(ws, packet);

		throw new TypeError("Client sent an unknown packet ID");
	} catch (error: any) {
		ws.close(socketClosureCodes.invalid_packet_data, error?.message);
	}
}

export function pushQueueIntoDownloaders(isAddingVideo?: boolean, alreadyCheckedOut: UUID[] = []) {
	for (const [key, value] of downloaders) {
		if (!queue.length) break;
		const { current_download } = value.data;
		if (current_download !== null) continue;

		const jobId = queue[0];
		// We don't want to loop through the list forever - if all of them are paused,
		// we can just quit this and wait until this session is deleted or recovered.
		if (alreadyCheckedOut.includes(jobId)) break;
		queue.splice(0, 1);
		// Something has to be HORRIBLY broken
		if (!patterns.uuid.test(jobId)) break;

		const job = jobs.get(jobId);
		if (job === undefined) break;

		// If this item should turn out to be paused - no problem,
		// we will push it to the back of the queue and just try again
		if (job.paused) {
			queue.push(jobId);
			alreadyCheckedOut.push(jobId);
			return pushQueueIntoDownloaders(isAddingVideo, alreadyCheckedOut);
		}

		const client = clients.get(job.session_id);
		if (client === undefined) break;

		job.assigned_downloader = key;
		job.pending_download = true;
		job.queue_position = null;

		value.data.current_download = jobId;

		const { metadata, lyrics, synced_lyrics } = job;

		value.send(
			createDownloaderboundPacket<DownloadStartS2DPacket>("download-start", {
				job_id: jobId,
				metadata,
				settings: client.data.settings,
				lyrics,
				synced_lyrics
			})
		);
		// Once the download actually starts, the downloader will send us confirmation and we can inform
		// the user of it. If some unforseen error should occur inbetween, we inform the user and kill the job.
		client.send(
			createClientboundPacket<JobDownloadPendingS2CPacket>("job-download-pending", {
				job_id: jobId,
				downloader_id: key
			})
		);
	}
	if (isAddingVideo) return;
	const queueMappedToClients = new Map<UUID, Map<UUID, number>>();
	for (const client of clients.values()) {
		if (!client.data.jobs.length) continue;
		queueMappedToClients.set(client.data.session_id, new Map());
	}
	for (let i = 0; i < queue.length; i++) {
		const jobId = queue[i];
		const job = jobs.get(jobId);
		if (!job) continue;
		job.queue_position = i;
		queueMappedToClients.get(job.session_id)?.set(jobId, i);
	}
	for (const [clientId, jobs] of queueMappedToClients.entries()) {
		if (!jobs.size) continue;
		const client = clients.get(clientId);
		if (!client) continue;
		client.send(createClientboundPacket<QueueUpdateS2CPacket>("queue-update", Object.fromEntries(jobs)));
	}
}

export function deleteJob(jobId: UUID) {
	const job = jobs.get(jobId);
	if (!job) return false;
	const client = clients.get(job.session_id);

	if (job.assigned_downloader) {
		console.error("Cannot delete job while it is downloading");
		return false;
	}

	const clientIndex = client?.data.jobs.indexOf(jobId) ?? -1;
	if (client && clientIndex !== -1) client.data.jobs.splice(clientIndex, 1);

	const queueIndex = queue.indexOf(jobId);
	if (queueIndex !== -1) queue.splice(queueIndex, 1);

	jobs.delete(jobId);

	pushQueueIntoDownloaders();
	return true;
}

export async function startPackagingSession(ws: ServerWebSocket<ClientSocketData>) {
	const createFailPacket = (reason?: string) => createClientboundPacket<PackageFailS2CPacket>("package-fail", { reason });
	if (ws.data.packaging_status !== "none") return ws.send(createFailPacket("Packaging already started"));
	if (hasAnyRunningJobs(ws)) return ws.send(createFailPacket("Jobs still queued/downloading"));
	ws.data.packaging_status = "working";
	ws.send(createClientboundPacket<PackageStartPacket>("package-start"));

	const pathToArchive = path.join(import.meta.dir, "downloads", ws.data.session_id);
	// Even the strongest compression does no difference as these binary files (MPEG) are
	// already so well compressed. It would also take up a lot of time to compress all of it.
	const archive = archiver("zip", { zlib: { level: 0 } });

	const writeStream = createWriteStream(pathToArchive + ".zip");
	archive.pipe(writeStream);
	archive.directory(pathToArchive, false);

	const notifyOfFailure = (error: archiver.ArchiverError) => {
		writeStream.end();
		ws.send(createFailPacket(error.code));
		ws.close(socketClosureCodes.packaging_failure, error.code);
	};

	archive.on("warning", (error) => {
		// In this case, we do not need to fail
		if (error.code === "ENOENT") return console.warn("Archiver tried to read unknown file/folder");
		notifyOfFailure(error);
	});

	archive.on("error", notifyOfFailure);

	await archive.finalize();
	ws.data.packaging_status = "done";
	ws.send(createClientboundPacket<PackageEndS2CPacket>("package-end"));
	ws.close(socketClosureCodes.default, "Thank you for using the service, goodbye :)");
}

function hasAnyRunningJobs(ws: ServerWebSocket<ClientSocketData>) {
	return Array.from(jobs.values()).some((job) => job.session_id === ws.data.session_id && !job.finished);
}

export function checkForAutoPackaging(ws: ServerWebSocket<ClientSocketData>) {
	if (hasAnyRunningJobs(ws) || !ws.data.settings.autoPackageOnFinish) return;
	startPackagingSession(ws);
}
