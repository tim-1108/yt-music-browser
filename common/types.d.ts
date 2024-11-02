export interface ServerConfig {
	sessionRecoveryTimeout: number;
	maxClients: number;
	maxPacketLength: number;
	maxAudioLength: number;
	maxTotalAudioLength: number;
	allowSameVideoMultipleTimes: boolean;
	downloadMinutes: number;
}

export interface LyricsData {
	lyrics: string | null;
	source: string | null;
}

export interface ClientSocketData {
	type: "client";
	settings: Omit<Omit<ClientSettings, "shouldAttemptSessionRecovery">, "version">;
	session_id: UUID;
	jobs: UUID[];
	packaging_status: "none" | "working" | "done";
	restored: boolean;
	pingIntervalId: Timer | null;
}

export interface ClientSettings {
	version: number;
	useAlbumSubfolders: boolean;
	audioBitrate: AudioBitrate;
	useSponsorblock: boolean;
	sponsorblockSegments: SponsorblockSegment[];
	useMaxResCovers: boolean;
	autoPackageOnFinish: boolean;
	shouldAttemptSessionRecovery: boolean;
	saveLyrics: boolean;
}

export type SponsorblockSegment = "music_offtopic" | "sponsor" | "intro" | "outro" | "selfpromo" | "preview" | "filler" | "interaction";

export interface DownloaderSocketData {
	type: "downloader";
	downloader_id: UUID;
	current_download: UUID | null;
	contact_url: string;
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`;
export type VideoID = string;

export interface VideoMetadata {
	video_id: string;
	title?: string;
	artists: string[];
	album?: string;
	cover?: string;
	track?: number;
}

export interface DownloadJob {
	assigned_downloader: UUID | null;
	pending_download: boolean;
	queue_position: number | null;
	job_id: UUID;
	session_id: UUID;
	metadata: VideoMetadata;
	paused: boolean;
	finished: boolean;
	artist_folder: boolean;
	album_folder: boolean;
	lyrics?: string;
	synced_lyrics?: string;
}

export interface PlaylistItem {
	id: string;
	name?: string;
	artists: IdentifiedString[];
	creators: string[];
	length?: string;
	album?: IdentifiedString;
	thumbnails: SizedThumbnail[];
	views?: string;
}

export interface IdentifiedString {
	name: string;
	id: string;
}

export interface SizedThumbnail {
	url: string;
	width: number;
	height: number;
}

export interface ExtendedVideoInfo {
	metadata: VideoMetadata;
	artists: IdentifiedString[];
	album: IdentifiedString;
	length?: string;
}

/**
 * A number ranging from 0 to 320. This is the number of kbps the audio should have.
 * Used in downloader with yt-dlp using --audio-quality <number>K
 */
export type AudioBitrate = number;

/**
 * Packets
 */

export type PacketData = Object;

interface BasePacket<K extends string, V extends PacketData> {
	id: K;
	data: V;
}

/**
 * Server -> Downloader
 */
type DownloaderboundPacketIdentifier = "init" | "download-start" | "restart";
interface BaseDownloaderboundPacket<K extends DownloaderboundPacketIdentifier, V extends PacketData> extends BasePacket<K, V> {}

export interface InitS2DPacket extends BaseDownloaderboundPacket<"init", { maxAudioLength: number }> {}
export interface DownloadStartS2DPacket
	extends BaseDownloaderboundPacket<
		"download-start",
		{
			job_id: UUID;
			metadata: VideoMetadata;
			lyrics?: string;
			synced_lyrics?: string;
			settings: Omit<ClientSettings, "shouldAttemptSessionRecovery" | "version">;
		}
	> {}
export interface RestartS2DPacket extends BaseDownloaderboundPacket<"restart", {}> {}

/**
 * Downloader -> Server
 */
export type ServerboundDownloaderPacketIdentifier =
	| "download-start-confirm"
	| "download-start-reject"
	| "download-status"
	| "download-finish"
	| "download-fail";
export interface BaseServerboundDownloaderPacket<K extends ServerboundDownloaderPacketIdentifier, V extends PacketData> extends BasePacket<K, V> {}

export interface DownloadStartConfirmD2SPacket extends BaseServerboundDownloaderPacket<"download-start-confirm", { job_id: UUID }> {}
export interface DownloadStartRejectD2SPacket extends BaseServerboundDownloaderPacket<"download-start-reject", { job_id: UUID }> {}
export interface DownloadStatusD2SPacket
	extends BaseServerboundDownloaderPacket<"download-status", { job_id: UUID; download_percentage?: number; status_string?: string }> {}
export interface DownloadFinishD2SPacket extends BaseServerboundDownloaderPacket<"download-finish", { job_id: UUID }> {}
export interface DownloadFailD2SPacket extends BaseServerboundDownloaderPacket<"download-fail", { job_id: UUID; reason?: string }> {}

/**
 * Server -> Client
 */
type ClientboundPacketIdentifier =
	| "welcome"
	| "job-rejection"
	| "job-accept"
	| "job-download-pending"
	| "job-download-start"
	| "job-download-finish"
	| "job-download-fail"
	| "job-download-status"
	| "queue-update"
	| "recovered-job-list"
	| "package-fail"
	| "package-start"
	| "package-end"
	| "downloader-list"
	| "queue-remove-confirm"
	| "restart-downloaders-response"
	| "ping";
interface BaseClientboundPacket<K extends ClientboundPacketIdentifier, V extends PacketData> extends BasePacket<K, V> {}

export interface WelcomeS2CPacket extends BaseClientboundPacket<"welcome", { session_id: UUID; config: ServerConfig }> {}
export interface JobRejectionS2CPacket extends BaseClientboundPacket<"job-rejection", { video_id: string; violations: string[] }> {}
export interface JobAcceptS2CPacket extends BaseClientboundPacket<"job-accept", { video_id: string; job_id: UUID; queue_position: number }> {}
export interface JobDownloadPendingS2CPacket extends BaseClientboundPacket<"job-download-pending", { job_id: UUID; downloader_id: UUID }> {}
export interface JobDownloadStartS2CPacket extends BaseClientboundPacket<"job-download-start", { job_id: UUID }> {}
export interface JobDownloadFinishS2CPacket extends BaseClientboundPacket<"job-download-finish", { job_id: UUID }> {}
export interface JobDownloadFailS2CPacket extends BaseClientboundPacket<"job-download-fail", { job_id: UUID; reason?: string }> {}
export interface JobDownloadStatusS2CPacket
	extends BaseClientboundPacket<"job-download-status", { job_id: UUID; download_percentage?: number; status_string?: string }> {}
export interface QueueUpdateS2CPacket extends BaseClientboundPacket<"queue-update", { [key: UUID]: number }> {}
export interface RecoveredJobListS2CPacket extends BaseClientboundPacket<"recovered-job-list", { jobs: DownloadJob[] }> {}
export interface PackageFailS2CPacket extends BaseClientboundPacket<"package-fail", { reason?: string }> {}
export interface PackageStartPacket extends BaseClientboundPacket<"package-start", {}> {}
export interface PackageEndS2CPacket extends BaseClientboundPacket<"package-end", {}> {}
export interface DownloaderListS2CPacket extends BaseClientboundPacket<"downloader-list", { downloaders: { id: UUID; name: string }[] }> {}
export interface QueueRemoveConfirmS2CPacket extends BaseClientboundPacket<"queue-remove-confirm", { job_id: UUID }> {}
export interface RestartDownloadersResponseS2CPacket extends BaseClientboundPacket<"restart-downloaders-response", { restarting: boolean }> {}
export interface PingS2CPacket extends BaseClientboundPacket<"ping", {}> {}

export interface JobCreateVideoMetadata extends VideoMetadata {
	artist_folder: boolean;
	album_folder: boolean;
	/**
	 * This field contains unsynced lyrics which will be stored in the USLT tag of the file
	 */
	lyrics?: string;
	/**
	 * Contains synced lyrics in the .lrc format to be stored in the SYLT id3v2 tag of the file
	 */
	synced_lyrics?: string;
}

/**
 * Client -> Server
 */
export type ServerboundClientPacketIdentifier =
	| "settings-update"
	| "job-create"
	| "package-request"
	| "ping-downloaders"
	| "queue-remove"
	| "restart-downloaders-request";
export interface BaseServerboundClientPacket<K extends ServerboundClientPacketIdentifier, V extends PacketData> extends BasePacket<K, V> {}

export interface SettingsUpdateC2SPacket extends BaseServerboundClientPacket<"settings-update", { settings: ClientSettings }> {}
export interface JobCreateC2SPacket extends BaseServerboundClientPacket<"job-create", JobCreateVideoMetadata> {}
export interface PackageRequestC2SPacket extends BaseServerboundClientPacket<"package-request", {}> {}
export interface PingDownloadersC2SPacket extends BaseServerboundClientPacket<"ping-downloaders", {}> {}
export interface QueueRemoveC2SPacket extends BaseServerboundClientPacket<"queue-remove", { job_id: UUID }> {}
export interface RestartDownloadersRequestC2SPacket extends BaseServerboundClientPacket<"restart-downloaders-request", { auth: string }> {}
