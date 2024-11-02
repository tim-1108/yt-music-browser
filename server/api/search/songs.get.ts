import { IdentifiedString } from "~/common/types";
import { cleanString, mapQueryEntries } from "~/server/cleaner";
import { API_ENDPOINTS, SEARCH_PARAMS, VIDEO_LENGTH_PATTERN } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import {
	BROWSE_PAGE_TYPES,
	combineFlexColumns,
	EMPTY_SEARCH_RESPONSE,
	getGradientFromRawSearchResult,
	isSearchResultExplicit,
	parseSearchGenerically,
	removeEmptyFlexColumns,
	SongSearchResult,
	SongsRawSearchResult
} from "~/server/types";

interface Response {
	items: SongSearchResult[];
	continuations: string[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return EMPTY_SEARCH_RESPONSE;
	const hasContinuation = query.has("continuation");
	const data = await makeInnerTubeRequest(
		API_ENDPOINTS.search,
		{ query: cleanString(query.get("q")), params: SEARCH_PARAMS.songs },
		address,
		query.get("continuation")
	);
	if (!data) return EMPTY_SEARCH_RESPONSE;
	const parsed = parseSearchGenerically<SongsRawSearchResult>(data, hasContinuation);

	if (!parsed.length) return EMPTY_SEARCH_RESPONSE;

	const elements = hasContinuation ? parsed[0] : parsed.find((x) => x.title === "Songs");
	if (!elements) return EMPTY_SEARCH_RESPONSE;

	return {
		items: elements.contents.map((item) => {
			const columns = removeEmptyFlexColumns(item.flexColumns);
			const combinedColumns = combineFlexColumns(columns);
			const gradient = getGradientFromRawSearchResult(item);
			const explicit = isSearchResultExplicit(item);
			const artists: IdentifiedString[] = [];
			let name: string | undefined = undefined;
			let album: IdentifiedString | undefined = undefined;
			let length: string | undefined = undefined;
			for (const column of combinedColumns) {
				// Can't destructure here
				const pageType = column.navigationEndpoint?.browseEndpoint?.pageType;
				if (pageType === BROWSE_PAGE_TYPES.artist) artists.push({ name: column.text, id: column.navigationEndpoint.browseEndpoint.browseId });
				else if (pageType === BROWSE_PAGE_TYPES.album) album = { name: column.text, id: column.navigationEndpoint.browseEndpoint.browseId };
				else if (column.navigationEndpoint?.watchEndpoint) name = column.text;
				else if (VIDEO_LENGTH_PATTERN.test(column.text)) length = column.text;
			}
			return {
				type: "song",
				artists,
				album,
				name,
				explicit,
				gradient,
				length,
				thumbnails: item.thumbnail.thumbnail.thumbnails,
				id: item.playlistItemData.videoId
			};
		}),
		continuations: elements.continuations
	};
});
