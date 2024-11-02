export const API_BASE = "https://youtubei.googleapis.com/youtubei/v1";
export const CLASSIC_API_BASE = "https://www.youtube.com/youtubei/v1";
export const API_ENDPOINTS = {
	search_suggest: "/music/get_search_suggestions",
	search: "/search",
	browse: "/browse",
	/**
	 * Next is the endpoint responsible for suggesting next videos/songs to play.
	 * We use it to fetch the browseId for the lyrics (as they are also a button on there)
	 */
	next: "/next"
};

export const VIDEO_LENGTH_PATTERN = /^(\d+:)?\d{1,2}:\d{1,2}$/;

export const DEFAULT_REQUEST_CONTEXT = {
	context: {
		client: {
			hl: "en-US",
			gl: "US",
			// WEB_REMIX is the YT Music client, using only WEB would be understood as default YT
			clientName: "WEB_REMIX",
			clientVersion: "1.00000101"
		}
	}
};

/**
 * Used to generate requests to non-music APIs to fetch a list of normal YouTube videos
 */
export const DEFAULT_CLASSIC_YT_REQUEST_CONTEXT = {
	context: {
		client: {
			hl: "en-US",
			gl: "US",
			clientName: "WEB",
			clientVersion: "1.00000101"
		}
	}
};

export const DEFAULT_REQUEST_HEADERS = {
	"User-Agent": "yt-music-downloader-api-proxy",
	"Content-Type": "application/json"
};

/**
 * This is binary data encoded in base64. The 6th byte encodes the filter:
 * 0x08 or 0x03 - songs
 * 0x10 - videos
 * 0x18 - albums
 * 0x48 - episodes
 * 0x50 - podcasts
 * 0x58 - profiles
 * 0x28 - playlists (but uses a lot of other bytes)
 * Each property seems to be seperated by 0x10 (could also be the value)
 * - all other bytes are yet to be known
 * - normally, chip clouds would return these values but values seem to be interchangable
 *
 * See the NewPipe extractor for these values
 * (https://github.com/TeamNewPipe/NewPipeExtractor/blob/dev/extractor/src/main/java/org/schabi/newpipe/extractor/services/youtube/extractors/YoutubeMusicSearchExtractor.java)
 */
export const SEARCH_PARAMS = {
	songs: "Eg-KAQwIARAAGAAgACgAMABqChAEEAUQAxAKEAk=",
	videos: "Eg-KAQwIABABGAAgACgAMABqChAEEAUQAxAKEAk=",
	albums: "Eg-KAQwIABAAGAEgACgAMABqChAEEAUQAxAKEAk=",
	playlists: "Eg-KAQwIABAAGAAgACgBMABqChAEEAUQAxAKEAk=",
	artists: "Eg-KAQwIABAAGAAgASgAMABqChAEEAUQAxAKEAk="
};
