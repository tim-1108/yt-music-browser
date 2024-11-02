export const YOUTUBE_WATCH_BASE = "https://youtube.com/watch?v=";
export const patterns = {
	downloaderProgress: /^\d+\/\d+$/,
	uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
};

export const DOWNLOADER_STATUS_STRINGS = [
	["[ExtractAudio]", "Extracting audio"],
	["[ModifyChapters]", "Removing SponsorBlock segments"],
	["[Metadata]", "Applying metadata"]
];

export const MIN_DOWNLOAD_UPDATE_PACKET_INTERVAL = 500;
