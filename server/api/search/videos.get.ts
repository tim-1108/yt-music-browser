import { IdentifiedString } from "~/common/types";
import { cleanString, mapQueryEntries } from "~/server/cleaner";
import { API_ENDPOINTS, SEARCH_PARAMS, VIDEO_LENGTH_PATTERN } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import {
	BROWSE_PAGE_TYPES,
	combineFlexColumns,
	EMPTY_SEARCH_RESPONSE,
	parseSearchGenerically,
	removeEmptyFlexColumns,
	SongsRawSearchResult,
	VideoSearchResult
} from "~/server/types";

interface Response {
	items: VideoSearchResult[];
	continuations: string[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return EMPTY_SEARCH_RESPONSE;
	const hasContinuation = query.has("continuation");
	const data = await makeInnerTubeRequest(
		API_ENDPOINTS.search,
		{ query: cleanString(query.get("q")), params: SEARCH_PARAMS.videos },
		address,
		query.get("continuation")
	);
	if (!data) return EMPTY_SEARCH_RESPONSE;
	const parsed = parseSearchGenerically<SongsRawSearchResult>(data, hasContinuation);

	if (!parsed.length) return EMPTY_SEARCH_RESPONSE;

	const elements = hasContinuation ? parsed[0] : parsed.find((x) => x.title === "Videos");
	if (!elements) return EMPTY_SEARCH_RESPONSE;

	return {
		items: elements.contents.map((item) => {
			const columns = removeEmptyFlexColumns(item.flexColumns);
			const combinedColumns = combineFlexColumns(columns);
			let name: string | undefined = undefined;
			const creators: string[] = [];
			const artists: IdentifiedString[] = [];
			let length: string | undefined = undefined;
			for (const column of combinedColumns) {
				// Can't destructure here
				const pageType = column.navigationEndpoint?.browseEndpoint?.pageType;
				if (pageType === BROWSE_PAGE_TYPES.artist) artists.push({ name: column.text, id: column.navigationEndpoint.browseEndpoint.browseId });
				if (pageType === BROWSE_PAGE_TYPES.user) creators.push(column.text);
				else if (column.navigationEndpoint?.watchEndpoint) name = column.text;
				else if (VIDEO_LENGTH_PATTERN.test(column.text)) length = column.text;
			}
			return {
				type: "video",
				creators,
				artists,
				name,
				length,
				thumbnails: item.thumbnail.thumbnail.thumbnails,
				id: item.playlistItemData.videoId
			};
		}),
		continuations: elements.continuations
	};
});
