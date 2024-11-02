/**
 * This is a reimplementation from the Python package "syncedlyrics" created by moehmeni,
 * specifically the MusixMatch provider code.
 * See more at https://github.com/moehmeni/syncedlyrics
 * or by install syncedlyrics using pip.
 */

import { mapQueryEntries } from "../cleaner";
import { getSimilarityScore } from "../similarity";
import { patterns } from "../types";

const TOKEN_EXPIRATION_TIME = 600 * 1000;
const token: { last_fetched: number; is_generating: boolean; token: string | null } = {
	last_fetched: 0,
	is_generating: false,
	token: null
};

const MUSIXMATCH_API_BASE = "https://apic-desktop.musixmatch.com/ws/1.1/";
const MUSIXMATCH_API_ACTIONS = {
	search: "track.search",
	token: "token.get",
	subtitles: "track.subtitle.get"
};

function generateQuery(additional?: Record<string, any>) {
	const record: Record<string, any> = {
		app_id: "web-desktop-app-v1.0",
		t: Date.now(),
		...additional
	};
	let query = "";
	let index = 0;
	for (const key in record) {
		const value = record[key];
		query += (index++ === 0 ? "?" : "&") + encodeURIComponent(key) + "=" + encodeURIComponent(value);
	}
	return query;
}

function generateResponse(lyrics: string | null, error?: string) {
	return {
		lyrics,
		error
	};
}

interface LyricsResponse {
	lyrics: string | null;
	error?: string;
}

export default defineEventHandler<Promise<LyricsResponse>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));

	if (!query.has("title")) return generateResponse(null, "No title passed");
	if (!query.has("artist")) return generateResponse(null, "No artist passed");
	const title = query.get("title");
	const artist = query.get("artist");
	const album = query.get("album");

	const now = Date.now();

	if (token.is_generating) {
		const successful = await holdUntilResolved();
		if (!successful) return generateResponse(null, "Failed to generate MusixMatch token");
	}
	if (now - TOKEN_EXPIRATION_TIME > token.last_fetched) {
		token.is_generating = true;
		const newToken = await fetchToken(address);
		if (newToken === null) {
			resolveAllRequests(false);
			return generateResponse(null, "Failed to generate MusixMatch token");
		}
		token.last_fetched = now;
		token.token = newToken;
		resolveAllRequests(true);
	}

	if (!token.token) return generateResponse(null, "No MusixMatch token found");
	const search = await makeRequest<{ track_list: { track: Track }[] }>(
		"search",
		{ q: `${title} ${artist} ${album}`, usertoken: token.token },
		address
	);
	if (!Array.isArray(search?.track_list) || !search.track_list.length) return generateResponse(null, "No results found");

	const tracks = search.track_list.map((item) => item.track as Track).filter((value) => value.has_subtitles === 1);
	// These represent the similarity as a percentage to the request the user has made
	const validTracks = tracks
		.map(({ track_name, artist_name, track_id }) => {
			const titleSimilarity = getSimilarityScore(title, track_name);
			const artistSimilarity = getSimilarityScore(artist, artist_name);
			return { total: titleSimilarity + artistSimilarity, id: track_id, valid: titleSimilarity >= 0.7 && artistSimilarity >= 0.6 };
		})
		.filter((value) => value.valid)
		.sort((a, b) => b.total - a.total);

	if (!validTracks.length) return generateResponse(null, "No valid tracks found");
	const { id } = validTracks[0];

	const subtitles = await makeRequest<{ subtitle: { subtitle_body: string } }>(
		"subtitles",
		{
			track_id: id,
			subtitle_format: "lrc",
			translation_fields_set: "minimal",
			usertoken: token.token
		},
		address
	);
	if (!subtitles?.subtitle?.subtitle_body) return generateResponse(null, "No valid lyrics found");
	return generateResponse(subtitles.subtitle.subtitle_body);
});

function resolveAllRequests(value: boolean) {
	token.is_generating = false;
	pendingRequests.forEach((resolve) => resolve(value));
	// Removes all (and also garbage collects them thankfully)
	pendingRequests.length = 0;
}

async function makeRequest<T>(action: keyof typeof MUSIXMATCH_API_ACTIONS, query?: Record<string, any>, address?: string, cookies?: string) {
	try {
		const response = await fetch(MUSIXMATCH_API_BASE + MUSIXMATCH_API_ACTIONS[action] + generateQuery(query), {
			headers: { "X-Forwarded-For": address ?? "127.0.0.1", Cookie: cookies ?? "" },
			redirect: "manual"
		});
		// On the first time when making a request, we have to use the cookies set in the header.
		// It redirects to the same path with the location header and a 301 response+
		if (response.status === 301) {
			if (cookies) return null;
			return makeRequest<T>(action, query, address, response.headers.getSetCookie().join(";").replace(patterns.cookieReplacement, ""));
		}
		return parseMusixmatchResponse<T>(response);
	} catch (error) {
		console.error(error);
		return null;
	}
}

async function fetchToken(address?: string): Promise<string | null> {
	const data = await makeRequest<{ user_token: string }>("token", {}, address);
	if (data === null) return null;
	const { user_token } = data;
	if (!patterns.musixmatchToken.test(user_token)) return null;
	return data.user_token;
}

interface MusixmatchResponse<T> {
	message: {
		header: {
			status_code: number;
			hint?: string;
		};
		body: T;
	};
}

interface Track {
	track_id: number;
	track_name: string;
	album_name: string;
	artist_name: string;
	has_subtitles: number;
}

async function parseMusixmatchResponse<T>(response: Response) {
	try {
		const data = (await response.json()) as MusixmatchResponse<T>;
		if (data.message.header.status_code !== 200) return null;
		return data.message.body;
	} catch (error) {
		console.error(error);
		return null;
	}
}

const pendingRequests: ((value: boolean) => void)[] = [];

function holdUntilResolved(): Promise<boolean> {
	return new Promise((resolve) => {
		pendingRequests.push(resolve);
	});
}
