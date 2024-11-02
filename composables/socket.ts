import type {
	BaseClientboundPacket,
	BaseServerboundClientPacket,
	ClientboundPacketIdentifier,
	DownloaderListS2CPacket,
	DownloadJob,
	IdentifiedString,
	JobAcceptS2CPacket,
	JobCreateC2SPacket,
	JobDownloadFailS2CPacket,
	JobDownloadFinishS2CPacket,
	JobDownloadPendingS2CPacket,
	JobDownloadStartS2CPacket,
	JobDownloadStatusS2CPacket,
	JobRejectionS2CPacket,
	PackageEndS2CPacket,
	PackageFailS2CPacket,
	PackageRequestC2SPacket,
	PackageStartPacket,
	PacketData,
	PingDownloadersC2SPacket,
	PingS2CPacket,
	QueueRemoveC2SPacket,
	QueueRemoveConfirmS2CPacket,
	QueueUpdateS2CPacket,
	RecoveredJobListS2CPacket,
	RestartDownloadersRequestC2SPacket,
	RestartDownloadersResponseS2CPacket,
	ServerConfig,
	SettingsUpdateC2SPacket,
	UUID,
	VideoID,
	VideoMetadata,
	WelcomeS2CPacket
} from "~/common/types";

type WebSocketState = 0 | 1 | 3;
export const useSocketState = () => useState<WebSocketState>("websocket-state", () => WebSocket.CLOSED /* 3 */);
/**
 * These are not sorted every time something updates, rather these are only updated when
 * the specific packets are recieved for the jobs.
 * THESE CONTAIN VIDEO IDS, NOT JOB IDS!
 */
export const useDownloadQueue = () => useState("downloads-queue", () => new Map<VideoID, LocalDownloadJob>());
export const useFinishedDownloads = () => useState("download-finished", () => new Map<VideoID, LocalDownloadJob>());
export const useCurrentDownloads = () => useState("downloads-current", () => new Map<VideoID, LocalDownloadJob>());

export const useSocketMessages = () => useState<SocketMessage[]>("socket-messages", () => []);

export const useWebSocketData = () => useState<LocalWebSocketData>("socket-data", () => structuredClone(EMPTY_SOCKET_DATA));

interface LocalWebSocketData {
	jobs: Map<UUID, LocalDownloadJob>;
	waiting_jobs: Map<VideoID, WaitingJob>;
	session_id: UUID | null;
	downloaders: { id: UUID; name: string }[];
	config: ServerConfig | null;
	is_packaging?: boolean;
}

/**
 * This is just intended for the user to see all the messages that
 * pass between server and client. Nothing of importance
 */
export interface SocketMessage {
	id: string;
	data: any;
	timestamp: string;
	type: "incoming" | "outgoing";
}

interface WaitingJob {
	metadata: VideoMetadata;
	artists: IdentifiedString[];
	album: IdentifiedString;
	length?: string;
}

/**
 * The server does not store the IDs of artists and album has it does not care about them.
 * However, on the client we might want to show that data.
 */
export type LocalDownloadJob = Omit<DownloadJob, "session_id" | "artist_folder" | "album_folder" | "paused" | "are_lyrics_synced"> & {
	download_percentage: number | null;
	status_string: string | null;
	artists: IdentifiedString[];
	album: IdentifiedString;
	failed?: boolean;
	fail_reason?: string;
	/**
	 * The length YouTube supplied for the video in seconds. Calculated using parseVideoLength and supplied when creating a download.
	 * Only used to estimate the time audio extraction using FFmpeg might take.
	 * The server does not trust this data (for good reason).
	 */
	length?: number;
};

const EMPTY_SOCKET_DATA: LocalWebSocketData = {
	jobs: new Map(),
	waiting_jobs: new Map(),
	downloaders: [],
	session_id: null,
	config: null
};

export const DEFAULT_SORTED_DOWNLOADS = {
	queue: [],
	finished: [],
	current: []
};

export let getWebSocket = (): WebSocket | undefined => {
	return undefined;
};

// @ts-ignore this exposes the socket to the global context (thus making it usable in the devtools console)
globalThis.webSocket = getOpenSocket;

const LISTENER_PAIRS: [keyof WebSocketEventMap, (event: any) => any][] = [
	["open", onSocketOpen],
	["close", onSocketClose],
	["message", onMessage],
	["error", onSocketError]
];

export function createSocket() {
	const state = useSocketState();
	if (state.value !== WebSocket.CLOSED) return console.warn("There is already a socket. Cannot create another.");
	/**
	 * This would get answered by the welcome packet telling us the same session ID.
	 * If the recovery fails, we cannot even connect to the socket. In that case,
	 * void the data upon user request or when the time has expired.
	 */
	useWebSocketData().value = structuredClone(EMPTY_SOCKET_DATA);
	const recovery = generateSessionRecovery();

	function getWebSocketInternal() {
		return socket;
	}

	const controller = new AbortController();
	const socket = new WebSocket(useRuntimeConfig().public.socketURL, recovery !== null ? ["session." + recovery] : undefined);
	useSocketState().value = WebSocket.CONNECTING;

	for (const [key, value] of LISTENER_PAIRS) {
		socket.addEventListener(key, value, { signal: controller.signal });
	}

	getWebSocket = getWebSocketInternal;
}

const wasSocketOpen = ref(false);
const SESSION_RECOVERY_INTERVAL_SECONDS = 10;
function onSocketOpen(event: Event) {
	useWebSocketData().value = structuredClone(EMPTY_SOCKET_DATA);
	useSocketMessages().value = [];
	useSocketState().value = WebSocket.OPEN; // 1
	wasSocketOpen.value = true;
}
async function onSocketClose(event: CloseEvent) {
	const { code, reason, wasClean } = event;
	const settings = useSettings();
	console.log("Socket disconnected with code", code, "due to", reason);
	useSocketState().value = WebSocket.CLOSED; // 3

	useDownloadQueue().value.clear();
	useFinishedDownloads().value.clear();
	useCurrentDownloads().value.clear();

	const data = useWebSocketData();
	const socket = getWebSocket();

	for (const [key, value] of LISTENER_PAIRS) {
		socket?.removeEventListener(key, value);
	}
	getWebSocket = () => undefined;

	const notification: WebNotification = { title: wasSocketOpen.value ? "Connection lost" : "No connection possible", timeout: 2 };
	wasSocketOpen.value = false;

	if (!settings.value.shouldAttemptSessionRecovery || data.value.is_packaging) {
		removeStoredSocketData();
		addNotification(notification);
		return;
	}
	// If this attempt (which also might have failed) was a recovery attempt - and was not successful, we
	// do not store the result of it.
	if (!useRecoveryAttemptState().value) writeStoredSocketData();
	addNotification({ ...notification, description: "Attempting to reconnect", timeout: SESSION_RECOVERY_INTERVAL_SECONDS });
	await sleep(SESSION_RECOVERY_INTERVAL_SECONDS * 1000);
	createSocket();
}
function onMessage(event: MessageEvent) {
	const socket = getWebSocket();
	const storage = useWebSocketData().value;
	if (socket === undefined) return console.error("The Impossible has been reached: Socket cannot be undefined in message handler");
	if (typeof event.data !== "string") throw new TypeError("This socket handler does not allow binary packets");

	type Packet = { id: ClientboundPacketIdentifier; data: PacketData };

	let packet: Packet | undefined = undefined;
	try {
		packet = JSON.parse(event.data) as Packet;
	} catch (error) {
		console.error("Could not read packet:", error);
		return;
	}

	// Ping packets do not need to be stored
	if (packet.id === "ping") return;
	console.log(packet.id, packet.data);
	useSocketMessages().value.push({ ...packet, timestamp: new Date().toLocaleTimeString(), type: "incoming" });

	if (isPacketOfType<WelcomeS2CPacket>(packet, "welcome")) return handleWelcomePacket(storage, packet);
	if (isPacketOfType<JobRejectionS2CPacket>(packet, "job-rejection")) return handleJobRejectionPacket(storage, packet);
	if (isPacketOfType<JobAcceptS2CPacket>(packet, "job-accept")) return handleJobAcceptPacket(storage, packet);
	if (isPacketOfType<JobDownloadPendingS2CPacket>(packet, "job-download-pending")) return handleDownloadPendingPacket(packet);
	if (isPacketOfType<JobDownloadStartS2CPacket>(packet, "job-download-start")) return handleDownloadStartPacket(packet);
	if (isPacketOfType<JobDownloadFinishS2CPacket>(packet, "job-download-finish")) return handleDownloadFinishPacket(packet);
	if (isPacketOfType<JobDownloadFailS2CPacket>(packet, "job-download-fail")) return handleDownloadFailPacket(packet);
	if (isPacketOfType<JobDownloadStatusS2CPacket>(packet, "job-download-status")) return handleStatusUpdatePacket(packet);
	if (isPacketOfType<QueueUpdateS2CPacket>(packet, "queue-update")) return handleQueueUpdate(storage, packet);
	if (isPacketOfType<RecoveredJobListS2CPacket>(packet, "recovered-job-list")) return handleRecoveredJobList(storage, packet);
	if (isPacketOfType<PackageFailS2CPacket>(packet, "package-fail")) return handlePackageFail(packet);
	if (isPacketOfType<PackageStartPacket>(packet, "package-start")) return handlePackageStart();
	if (isPacketOfType<PackageEndS2CPacket>(packet, "package-end")) return handlePackageEnd();
	if (isPacketOfType<DownloaderListS2CPacket>(packet, "downloader-list")) return handleDownloaderListPacket(storage, packet);
	if (isPacketOfType<QueueRemoveConfirmS2CPacket>(packet, "queue-remove-confirm")) return handleQueueRemoval(storage, packet);
	if (isPacketOfType<RestartDownloadersResponseS2CPacket>(packet, "restart-downloaders-response")) return handleRestartResponse(packet);

	console.error("Got packet of invalid ID from server. Please check if both are on the latest version.");
}
function onSocketError(event: Event) {
	console.error("Socket error:", event);
}

function isPacketOfType<T extends BaseClientboundPacket<any, any>>(packet: any, id: T["id"]): packet is T {
	return packet.id === id;
}

export function createPacket<T extends BaseServerboundClientPacket<any, any>>(id: T["id"], data: T["data"] = {}) {
	useSocketMessages().value.push({ id, data, timestamp: new Date().toLocaleTimeString(), type: "outgoing" });
	return JSON.stringify({ id, data });
}

function handleWelcomePacket(storage: LocalWebSocketData, packet: WelcomeS2CPacket) {
	submitClientSettings();
	// This integrates the session_id and the config fields
	useWebSocketData().value = { ...storage, ...packet.data };
	checkIfSessionWasRecovered(packet.data.session_id);
}

function handleJobAcceptPacket(storage: LocalWebSocketData, { data: { job_id, video_id, queue_position } }: JobAcceptS2CPacket) {
	const waitingJobData = storage.waiting_jobs.get(video_id);
	if (waitingJobData === undefined) return console.warn("Server sent a job for a video ID we do not have");
	storage.waiting_jobs.delete(video_id);
	const job: LocalDownloadJob = {
		assigned_downloader: null,
		pending_download: false,
		queue_position,
		job_id,
		// This contains the metadata and the IdentifiedStrings for artists and album
		...waitingJobData,
		download_percentage: null,
		status_string: "Starting download",
		finished: false,
		length: parseVideoLength(waitingJobData.length)
	};
	storage.jobs.set(job_id, job);
	useDownloadQueue().value.set(video_id, job);
}

function handleJobRejectionPacket(storage: LocalWebSocketData, { data: { video_id, violations } }: JobRejectionS2CPacket) {
	storage.waiting_jobs.delete(video_id);
	const unorderedList = violations.map((value) => `<li>${value}</li>`).join("");
	addNotification({
		title: "Could not request download",
		description: `For video ID ${video_id} due to<ul>${unorderedList}</ul>`,
		timeout: 10
	});
}

function handleDownloadPendingPacket({ data: { job_id, downloader_id } }: JobDownloadPendingS2CPacket) {
	const job = getJob(job_id);
	if (!job) return;
	job.assigned_downloader = downloader_id;
	job.pending_download = true;
	job.queue_position = null;
	useDownloadQueue().value.delete(job.metadata.video_id);
	useCurrentDownloads().value.set(job.metadata.video_id, job);
}

function handleDownloadStartPacket({ data: { job_id } }: JobDownloadStartS2CPacket) {
	const job = getJob(job_id);
	if (!job || !job.pending_download || !job.assigned_downloader) return;
	job.pending_download = false;
}

function handleDownloadFinishPacket({ data: { job_id } }: JobDownloadFinishS2CPacket) {
	const job = getJob(job_id);
	if (!job || job.finished || job.failed) return;
	job.assigned_downloader = null;
	job.finished = true;
	removeJobFromCurrentList(job);
}

function handleDownloadFailPacket({ data: { job_id, reason } }: JobDownloadFailS2CPacket) {
	const job = getJob(job_id);
	if (!job || job.finished || job.failed) return;
	job.assigned_downloader = null;
	job.failed = true;
	job.fail_reason = reason;
	removeJobFromCurrentList(job);
}

function removeJobFromCurrentList(job: LocalDownloadJob) {
	const { video_id } = job.metadata;
	useCurrentDownloads().value.delete(video_id);
	useFinishedDownloads().value.set(video_id, job);
}

const benchmark = new Map<UUID, { start: number; length: number }>();
let count = 0;
let total = 0;

function handleStatusUpdatePacket({ data: { job_id, status_string, download_percentage } }: JobDownloadStatusS2CPacket) {
	const job = getJob(job_id);
	if (!job || job.assigned_downloader === null) return;

	if (job.length && download_percentage) {
		benchmark.set(job_id, { start: Date.now(), length: job.length });
	}

	if (status_string === "Removing segments") {
		const data = benchmark.get(job_id);
		if (data) {
			const secondsTaken = Math.round((Date.now() - data.start) / 1000);
			total += secondsTaken / data.length;
			count++;
		}
		benchmark.delete(job_id);
		console.debug("BENCHMARK:", total / count);
	}

	job.status_string = status_string ?? null;
	job.download_percentage = download_percentage ?? null;
}

function handleQueueUpdate(storage: LocalWebSocketData, { data }: QueueUpdateS2CPacket) {
	for (const key in data) {
		const value = data[key as UUID];
		const job = storage.jobs.get(key as UUID);
		if (job) job.queue_position = value;
	}
}

function handleRecoveredJobList(storage: LocalWebSocketData, { data: { jobs } }: RecoveredJobListS2CPacket) {
	const queue = useDownloadQueue();
	const current = useCurrentDownloads();
	const finished = useFinishedDownloads();
	for (const job of jobs) {
		const jobData = {
			...job,
			// There are some things we just cannot recover
			download_percentage: null,
			status_string: "Unknown",
			artists: job.metadata.artists.map((artist) => ({ name: artist, id: "" })),
			album: {
				id: "",
				name: job.metadata.album ?? ""
			}
		};
		storage.jobs.set(job.job_id, jobData);
		if (job.assigned_downloader) current.value.set(job.metadata.video_id, jobData);
		else if (job.queue_position !== null) queue.value.set(job.metadata.video_id, jobData);
		// Here, we also cannot know whether the job failed or not
		else if (job.finished) finished.value.set(job.metadata.video_id, jobData);
	}
}

function handlePackageFail({ data: { reason } }: PackageFailS2CPacket) {
	// There is nothing else we can do. The session has been killed and
	// is not restorable after requesting packaging.
	addNotification({ title: "Could not package files", description: reason });
}

function handlePackageStart() {
	useWebSocketData().value.is_packaging = true;
}

async function handlePackageEnd() {
	const element = document.createElement("a");
	const url = new URL(useRuntimeConfig().public.downloadURL);
	url.pathname = useWebSocketData().value.session_id as string; // This is not gonna be null here...
	element.href = url.toString();
	await sleep(1000);
	element.click();
}

function handleQueueRemoval(storage: LocalWebSocketData, packet: QueueRemoveConfirmS2CPacket) {
	const { job_id } = packet.data;
	const job = storage.jobs.get(job_id);
	if (!job) return;
	storage.jobs.delete(job_id);
	useDownloadQueue().value.delete(job.metadata.video_id);
}

function handleRestartResponse(packet: RestartDownloadersResponseS2CPacket) {
	const title = packet.data.restarting ? "Restarting downloaders" : "Failed to restart downloaders";
	const description = packet.data.restarting
		? "All running downloads will be cancelled"
		: "Either the password is incorrect or a timeout is active";
	addNotification({ title, description, timeout: 3 });
}

function getJob(jobId: UUID) {
	return useWebSocketData().value.jobs.get(jobId);
}

function handleDownloaderListPacket(storage: LocalWebSocketData, packet: DownloaderListS2CPacket) {
	storage.downloaders = packet.data.downloaders;
}

export function deleteQueuedJob(jobId: UUID) {
	const job = getJob(jobId);
	if (!job || job.queue_position === null) return;
	sendAnyPacket<QueueRemoveC2SPacket>("queue-remove", { job_id: jobId });
}

export function requestPackaging() {
	sendAnyPacket<PackageRequestC2SPacket>("package-request");
}

/**
 * Only returns the socket if it is open. Otherwise returns undefined.
 * @returns The WebSocket
 */
function getOpenSocket() {
	const state = useSocketState();
	if (state.value !== WebSocket.OPEN) return undefined;
	return getWebSocket();
}

export function submitClientSettings() {
	const settings = useSettings();
	sendAnyPacket<SettingsUpdateC2SPacket>("settings-update", { settings: settings.value });
}

export async function addDownload(
	metadata: VideoMetadata,
	artists?: IdentifiedString[],
	album?: IdentifiedString,
	length?: string,
	shouldCreateArtistFolder: boolean = true,
	shouldCreateAlbumFolder: boolean = true
) {
	const socket = getOpenSocket();
	if (!socket) return;
	const data = useWebSocketData();
	const settings = useSettings();
	const unsyncedLyrics = useLyrics();
	const syncedLyricsList = useSyncedLyrics();
	if (settings.value.saveLyrics) {
		await fetchVideoLyrics(metadata.video_id);
		if (metadata.title && metadata.artists.length) await fetchAccurateLyrics(metadata.video_id, metadata.title, metadata.artists[0]);
	}
	const [lyrics, syncedLyrics] = [unsyncedLyrics, syncedLyricsList].map((list) =>
		settings.value.saveLyrics ? (list.value.get(metadata.video_id)?.lyrics ?? undefined) : undefined
	);
	socket.send(
		createPacket<JobCreateC2SPacket>("job-create", {
			...metadata,
			artist_folder: shouldCreateArtistFolder,
			album_folder: shouldCreateAlbumFolder,
			// If the lyrics field of the lyrics is null, it is replaced with undefined
			lyrics,
			synced_lyrics: syncedLyrics
		})
	);
	data.value.waiting_jobs.set(metadata.video_id, { metadata, artists: artists ?? [], album: album ?? rawToIdentifiedString(), length });
}

function sendAnyPacket<T extends BaseServerboundClientPacket<any, any>>(type: T["id"], data: T["data"] = {}) {
	const socket = getOpenSocket();
	if (!socket) return;
	socket.send(createPacket<T>(type, data));
}

export function pingDownloaders() {
	sendAnyPacket<PingDownloadersC2SPacket>("ping-downloaders");
}

export function requestDownloadersRestart(password: string) {
	sendAnyPacket<RestartDownloadersRequestC2SPacket>("restart-downloaders-request", { auth: password });
}
