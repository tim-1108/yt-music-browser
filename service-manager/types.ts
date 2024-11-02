import { patterns } from ".";
import type { SchemaEntry } from "./validator";
export const SPONSORBLOCK_SEGMENTS = ["music_offtopic", "sponsor", "intro", "outro", "selfpromo", "preview", "filler", "interaction"];

export const clientSettingsSchema: SchemaEntry[] = [
	{ key: "version", type: "number", min: 1, max: 999, required: true, disallow_floats: true },
	{ key: "useAlbumSubfolders", type: "boolean", required: true },
	{ key: "audioBitrate", type: "number", required: true, min: 0, max: 320, disallow_floats: true },
	{ key: "useSponsorblock", type: "boolean", required: true },
	{ key: "sponsorblockSegments", type: "array", options: SPONSORBLOCK_SEGMENTS, required: true },
	{ key: "useMaxResCovers", type: "boolean", required: true },
	{ key: "autoPackageOnFinish", type: "boolean", required: false },
	{ key: "shouldAttemptSessionRecovery", type: "boolean", required: false },
	{ key: "saveLyrics", type: "boolean", required: false }
];

export const ALLOWED_THUMBNAIL_HOSTS = [/^([0-9a-z]{1,3}).googleusercontent.com$/, /^i.ytimg.com$/, /^img.youtube.com$/];

export const videoMetadataSchema: SchemaEntry[] = [
	{ key: "video_id", type: "string", required: true, pattern: /^[A-Za-z\-_0-9]{11}$/ },
	{ key: "cover", type: "string", required: false, fn: validateVideoCoverUrl },
	{ key: "artists", type: "array", required: true, array_type: "string" },
	{ key: "title", type: "string", required: false },
	{ key: "album", type: "string", required: false },
	{ key: "track", type: "number", required: false, min: 1, max: 999, disallow_floats: true },
	{ key: "artist_folder", type: "boolean", required: true },
	{ key: "album_folder", type: "boolean", required: true },
	{ key: "lyrics", type: "string", required: false },
	{ key: "synced_lyrics", type: "string", required: false }
];

function validateVideoCoverUrl(value: any) {
	if (typeof value !== "string") return true;
	try {
		const url = new URL(value);
		const isUsingHTTPS = url.protocol === "https:";
		const noAuthentication = url.password === "" && url.username === "";
		const noPortSpecified = url.port === "";
		const usesAllowedHost = ALLOWED_THUMBNAIL_HOSTS.some((host) => host.test(url.host));
		return isUsingHTTPS && noAuthentication && noPortSpecified && usesAllowedHost;
	} catch (error) {
		return false;
	}
}

export function filterStrings(...strings: (string | undefined)[]) {
	return strings
		.filter((string) => typeof string === "string" && string.length)
		.map((string) => string!.replace(patterns.reservedSymbols, "").replace(patterns.windowsReservedNames, "")) as string[];
}
