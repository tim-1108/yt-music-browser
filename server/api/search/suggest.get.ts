import { cleanString, mapQueryEntries, removeSizeFromAsset } from "~/server/cleaner";
import { API_ENDPOINTS } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import {
	BROWSE_PAGE_TYPES,
	combineFlexColumns,
	FlexColumn,
	Icon,
	NavigationEndpoint,
	removeEmptyFlexColumns,
	TextRuns,
	Thumbnail
} from "~/server/types";

type Content = (RawSearchResult | RawSearchSuggestion)[][];
type Response = (SearchSuggestionWithResult | SearchSuggestion)[];

interface RawSearchSuggestion {
	suggestion: TextRuns;
	navigationEndpoint: NavigationEndpoint;
	icon: Icon;
}

export interface SearchSuggestion {
	type: "SUGGESTION";
	text: string;
}

export interface SearchSuggestionWithResult {
	type: "ARTIST" | "SONG" | "ALBUM" | "PLAYLIST" | "PODCAST" | "UNKNOWN";
	cover?: string;
	title: string;
	artists?: string[];
	album?: string;
	album_type?: string;
	id: string;
}

interface RawSearchResult {
	flexColumns: FlexColumn[];
	navigationEndpoint: NavigationEndpoint;
	thumbnail: Thumbnail;
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return [];
	const data = await makeInnerTubeRequest<Content>(API_ENDPOINTS.search_suggest, { input: cleanString(query.get("q")) }, address);
	if (!data) return [];

	const combinedData = data.reduce((acc, value) => acc.concat(value), []);

	return combinedData.map((item) => {
		if ("suggestion" in item) {
			return {
				type: "SUGGESTION",
				text: item.navigationEndpoint.searchEndpoint.query
			};
		}

		const isArtist = item.navigationEndpoint.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.artist;
		const isAlbum = item.navigationEndpoint.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.album;
		const isPlaylist = item.navigationEndpoint.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.playlist;
		const isPodcast = item.navigationEndpoint.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.podcast;
		const isSong = "watchEndpoint" in item.navigationEndpoint;

		const columns = removeEmptyFlexColumns(item.flexColumns);
		const combinedColumns = combineFlexColumns(columns);

		const artists = combinedColumns
			.filter((text) => text.navigationEndpoint?.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.artist)
			.map((text) => text.text);
		const album =
			combinedColumns.find((text) => text.navigationEndpoint?.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.album)?.text ?? undefined;

		const album_type = columns[1][0]?.text;
		const title = columns[0][0]?.text;
		const cover = removeSizeFromAsset(item.thumbnail?.thumbnail?.thumbnails[0]?.url);

		// The browseId is not the playlist id, rather it is sent via a request to the browse endpoint (works for artists, playlists and albums)
		const id = isSong ? item.navigationEndpoint.watchEndpoint.videoId : item.navigationEndpoint.browseEndpoint?.browseId;

		const type = isSong ? "SONG" : isAlbum ? "ALBUM" : isArtist ? "ARTIST" : isPlaylist ? "PLAYLIST" : isPodcast ? "PODCAST" : "UNKNOWN";
		return {
			type,
			cover,
			artists: artists.length ? artists : undefined,
			album_type,
			title,
			album,
			id
		};
	});
});
