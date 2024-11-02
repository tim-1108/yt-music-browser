import { cleanString, mapQueryEntries } from "~/server/cleaner";
import { API_ENDPOINTS, SEARCH_PARAMS } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import {
	AlbumSearchResult,
	BaseRawSearchResult,
	BROWSE_PAGE_TYPES,
	combineFlexColumns,
	EMPTY_SEARCH_RESPONSE,
	getGradientFromRawSearchResult,
	isSearchResultExplicit,
	parseSearchGenerically,
	removeEmptyFlexColumns
} from "~/server/types";

interface Response {
	items: AlbumSearchResult[];
	continuations: string[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return EMPTY_SEARCH_RESPONSE;
	const hasContinuation = query.has("continuation");
	const data = await makeInnerTubeRequest(
		API_ENDPOINTS.search,
		{ query: cleanString(query.get("q")), params: SEARCH_PARAMS.albums },
		address,
		query.get("continuation")
	);
	if (!data) return EMPTY_SEARCH_RESPONSE;
	const parsed = parseSearchGenerically<BaseRawSearchResult>(data, hasContinuation);

	if (!parsed.length) return EMPTY_SEARCH_RESPONSE;

	const elements = hasContinuation ? parsed[0] : parsed.find((x) => x.title === "Albums");
	if (!elements) return EMPTY_SEARCH_RESPONSE;

	return {
		items: elements.contents.map((item) => {
			const columns = removeEmptyFlexColumns(item.flexColumns);
			const combinedColumns = combineFlexColumns(columns);
			const explicit = isSearchResultExplicit(item);
			const gradient = getGradientFromRawSearchResult(item);
			const artists = combinedColumns
				.filter((column) => column.navigationEndpoint?.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.artist)
				.map((column) => ({ name: column.text, id: column.navigationEndpoint.browseEndpoint.browseId }));
			const name = columns[0][0]?.text;
			const album_type = columns[1][0]?.text;
			return {
				type: "album",
				artists,
				album_type,
				name,
				explicit,
				gradient,
				thumbnails: item.thumbnail.thumbnail.thumbnails,
				id: item.navigationEndpoint.browseEndpoint.browseId
			};
		}),
		continuations: elements.continuations
	};
});
