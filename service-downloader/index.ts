import type {
	BaseDownloaderboundPacket,
	InitS2DPacket,
	DownloadStartS2DPacket,
	DownloadStartRejectD2SPacket,
	DownloadStartConfirmD2SPacket,
	DownloadStatusD2SPacket,
	DownloadFailD2SPacket,
	DownloadFinishD2SPacket,
	VideoMetadata,
	RestartS2DPacket
} from "../common/types";
import { createMetadata } from "./metadata";
import downloadStartS2DHandler from "./packet-handlers/download-start";
import initS2DHandler from "./packet-handlers/init";
import { createServerboundPacket, isDownloaderboundPacketOfType } from "./packets";
import { globalSettings } from "./storage";
import { DOWNLOADER_STATUS_STRINGS, MIN_DOWNLOAD_UPDATE_PACKET_INTERVAL, patterns, YOUTUBE_WATCH_BASE } from "./types";

import { unlink, rm, readdir, rename, mkdir } from "node:fs/promises";
import path from "node:path";

if (!process.env.MANAGER_URL) throw new ReferenceError("Cannot register with manager if url is undefined");
if (!process.env.DOWNLOADER_CREATION_KEY) throw new ReferenceError("Cannot create downloader if key is undefined");
if (!process.env.CONTACT_URL) throw new ReferenceError("Cannot send videos to manager if no contact url is set");

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

const downloadableFiles: UUID[] = [];

function isUUID(text: string): text is UUID {
	return patterns.uuid.test(text);
}

async function initialize() {
	console.log("Initializing downloader...");
	await mkdir(path.join(import.meta.dir, "downloads"), { recursive: true }).catch(() => {});
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
	if (typeof process.env.COOKIES !== "string") return;
	console.log("Writing cookies to file...");
	Bun.write(Bun.file(path.join(import.meta.dir, "cookies.txt")), Buffer.from(process.env.COOKIES, "base64").toString("utf-8"));
}

initialize();

// This HTTP server allows for pings to wake up the downloader and
// for transferring the downloaded files back to the manager
Bun.serve({
	port: 4000,
	fetch(request) {
		const url = new URL(request.url);
		const pathname = url.pathname.substring(1);
		if (isUUID(pathname)) {
			const index = downloadableFiles.indexOf(pathname);
			if (index === -1) return new Response(null, { status: 404 });
			downloadableFiles.splice(index, 1);
			const filePath = path.join(import.meta.dir, "downloads", pathname + ".mp3");
			const fileHandler = Bun.file(filePath);
			setTimeout(() => unlink(filePath), 60 * 1000);
			return new Response(fileHandler);
		}
		return new Response(null, { status: 204 });
	}
});

export const ws = new WebSocket(process.env.MANAGER_URL, [`key.${process.env.DOWNLOADER_CREATION_KEY}`, `contact.${process.env.CONTACT_URL}`]);

// When recieving messages from the server, we can assume they are actually valid.
// There need not be any security checks on the data as the server SHOULD have
// validated all user input sent (video ids, cover urls)
ws.onmessage = (event) => {
	if (typeof event.data !== "string") return;
	const packet = JSON.parse(event.data) as BaseDownloaderboundPacket<any, any>;
	if (isDownloaderboundPacketOfType<InitS2DPacket>(packet, "init")) return initS2DHandler(packet);
	if (isDownloaderboundPacketOfType<DownloadStartS2DPacket>(packet, "download-start")) return downloadStartS2DHandler(packet);
	if (isDownloaderboundPacketOfType<RestartS2DPacket>(packet, "restart")) return ws.close(1000, "Server requested restart");
	console.warn("Unknown packet received!");
};

ws.onopen = () => {
	console.log("Connected to socket under", process.env.MANAGER_URL);
};

ws.onclose = (event) => {
	console.log("Socket connection lost with code", event.code, "due to", event.reason);
	console.warn("This will kill the process and it should reboot at any moment...");
	process.exit(1);
};

/**
 * On googleusercontent.com, the images most often end with =w60-h60-l90-rj. That whole thing
 * has to be removed for the full resolution image to be shown. Any number of parameters can be left out.
 */
const COVER_RESOLUTION_PATTERN = /(=(-{0,1}([whl]\d+|rj))+)$/;

async function downloadCover(cover: string | undefined, fetchMaxResCover: boolean) {
	if (!cover) return null;
	try {
		const response = await fetch(fetchMaxResCover ? cover.replace(COVER_RESOLUTION_PATTERN, "") : cover);
		const contentType = response.headers.get("Content-Type");
		if (!contentType?.startsWith("image/")) return null;
		return await response.blob();
	} catch {
		return null;
	}
}

let isDownloadRunning = false;
export async function startDownload(metadata: VideoMetadata, settings: DownloadStartS2DPacket["data"]["settings"], jobId: UUID) {
	if (isDownloadRunning) {
		console.warn("Manager sent a video while the previous one was still downloading. Not very nice!");
		ws.send(createServerboundPacket<DownloadStartRejectD2SPacket>("download-start-reject", { job_id: jobId }));
		return;
	}
	ws.send(createServerboundPacket<DownloadStartConfirmD2SPacket>("download-start-confirm", { job_id: jobId }));
	const coverData = await downloadCover(metadata.cover, settings.useMaxResCovers);

	const fileExtension = ".pre.mp3";
	const filePath = path.join(import.meta.dir, "downloads", jobId);

	const sponsorblockCommand = settings.useSponsorblock ? "--sponsorblock-remove" : "";
	// Even if sponsorblock is disabled, the user might still have some of them in the list
	const sponsorblockSegments = settings.useSponsorblock ? settings.sponsorblockSegments.join(",") : "";

	const shouldUseCookies = typeof process.env.COOKIES === "string";
	const cookieCommand = shouldUseCookies ? ["--cookies", "cookies.txt"] : [];

	const downloader = Bun.spawn({
		cmd: [
			"yt-dlp",
			"-vv",
			"-f",
			settings.audioBitrate,
			"--extract-audio",
			"--audio-format",
			"mp3",
			"--audio-quality",
			"0",
			...cookieCommand,
			sponsorblockCommand,
			sponsorblockSegments,
			"--match-filter",
			`duration < ${globalSettings.get("max-audio-length")} & !is_live`,
			"--progress-template",
			"download:%(progress.downloaded_bytes)d/%(progress.total_bytes)d",
			"--progress",
			"-o",
			filePath + fileExtension,
			"--postprocessor-args",
			// This should only run through the metadata postprocessor,
			// however, when specifying it, we would also have to use the --embed-metadata
			// flag, which would cause video link, creator and description to be all embedded.
			[
				createMetadata("title", metadata.title),
				createMetadata("artist", metadata.artists.join(" & ")),
				createMetadata("album", metadata.album),
				createMetadata("track", metadata.track?.toFixed(0))
			].join(" "),
			YOUTUBE_WATCH_BASE + metadata.video_id
		],
		stderr: "pipe",
		stdout: "pipe"
	});

	const errorMessages: string[] = [];
	async function readStream(stream: ReadableStream<Uint8Array>, type: "stdout" | "stderr") {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let previousPercentage = 0;
		let lastSentTimestamp = 0;
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			const text = decoder.decode(value).trim();
			console.log(text);
			if (type === "stderr") {
				errorMessages.push(text);
				continue;
			}
			// It is not one of our custom download progress strings, thus it might
			// be something of relevance here.
			if (!patterns.downloaderProgress.test(text)) {
				const strings = DOWNLOADER_STATUS_STRINGS.find((value) => text.includes(value[0]));
				if (strings) {
					ws.send(
						createServerboundPacket<DownloadStatusD2SPacket>("download-status", {
							job_id: jobId,
							status_string: strings[1]
						})
					);
				}
				if (done) break;
				continue;
			}
			const [current, total] = text.split("/").map((value) => parseInt(value));
			const percentage = Math.round((current / total) * 1000) / 1000;
			const now = performance.now();
			if (percentage === previousPercentage || lastSentTimestamp > now - MIN_DOWNLOAD_UPDATE_PACKET_INTERVAL) {
				if (done) break;
				continue;
			}
			previousPercentage = percentage;
			lastSentTimestamp = now;
			ws.send(
				createServerboundPacket<DownloadStatusD2SPacket>("download-status", {
					job_id: jobId,
					download_percentage: percentage
				})
			);
		}
	}

	readStream(downloader.stdout, "stdout");
	readStream(downloader.stderr, "stderr");

	await downloader.exited;

	const exitCode = downloader.exitCode as number;
	// yt-dlp exists with code 1 whenever the video hasn't been found, isn't downloadable, etc.
	if (exitCode !== 0) {
		console.error(errorMessages.join("\n"));
		console.error("Downloader exited with exit code", exitCode);
		deleteFileAndPreFile(filePath);
		ws.send(createServerboundPacket<DownloadFailD2SPacket>("download-fail", { job_id: jobId, reason: errorMessages.join("\n") }));
		return;
	}

	if (coverData !== null) {
		ws.send(createServerboundPacket<DownloadStatusD2SPacket>("download-status", { job_id: jobId, status_string: "Applying Cover" }));
		const patcher = Bun.spawn({
			cmd: [
				"ffmpeg",
				"-i",
				filePath + fileExtension,
				// This is where our stdin fills the role
				"-i",
				"-",
				"-map",
				"0",
				"-map",
				"1",
				"-c",
				"copy",
				"-id3v2_version",
				"3",
				"-metadata:s:v",
				'title="Album cover"',
				"-metadata:s:v",
				'comment="Cover (front)"',
				filePath + ".mp3"
			],
			stdout: null,
			stderr: null,
			stdin: coverData
		});
		await patcher.exited;
		// This is our temporary file with the .pre.mp3 extension
		unlink(filePath + fileExtension).catch((reason) => console.error("Could not delete a temporary file due to", reason));
		const exitCode = downloader.exitCode as number;
		if (exitCode !== 0) {
			console.error("Patcher exited with code", exitCode);
			deleteFileAndPreFile(filePath);
			ws.send(createServerboundPacket<DownloadFailD2SPacket>("download-fail", { job_id: jobId, reason: "Cover apply failed" }));
			return;
		}
	} else {
		await rename(filePath + fileExtension, filePath + ".mp3");
	}

	console.log("Download finished for", jobId);
	downloadableFiles.push(jobId);
	ws.send(createServerboundPacket<DownloadFinishD2SPacket>("download-finish", { job_id: jobId }));
}

async function deleteFileAndPreFile(path: string) {
	await unlink(path + ".pre.mp3").catch(() => void 0);
	await unlink(path + ".mp3").catch(() => void 0);
}
