import type { LyricsData, VideoID } from "~/common/types";

export const useLyrics = () => useState("lyrics-map", () => new Map<VideoID, LyricsData>());
export const useSyncedLyrics = () => useState("synced-lyrics-map", () => new Map<VideoID, LyricsData>());
export async function fetchVideoLyrics(videoId: VideoID) {
	const list = useLyrics();
	if (list.value.has(videoId)) return;
	try {
		const data = await $fetch("/api/lyrics", { params: { id: videoId } });
		// If the lyrics did not load correctly, that HAS to mean
		// that YT does not have them (so if this is called again from anywhere, we don't need to look again)
		list.value.set(videoId, data);
	} catch (error) {
		console.error("Could not fetch lyrics for video", videoId, "due to", error);
	}
}

export async function fetchAccurateLyrics(videoId: VideoID, title: string, artist: string, album?: string) {
	const list = useSyncedLyrics();
	if (list.value.has(videoId)) return;
	try {
		const data = await $fetch("/api/accurate-lyrics", { params: { title, artist, album } });
		if (data.error) {
			console.log(`Could not load synced lyrics for: ${title} by ${artist} due to ${data.error}`);
			return;
		}
		list.value.set(videoId, { lyrics: data.lyrics, source: "MusixMatch" });
	} catch (error) {
		console.error("Error for synced lyrics", error);
	}
}
