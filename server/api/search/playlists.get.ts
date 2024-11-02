import { IdentifiedString } from "~/common/types";
import { cleanString, mapQueryEntries } from "~/server/cleaner";
import { API_ENDPOINTS, SEARCH_PARAMS } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import {
	BaseRawSearchResult,
	BROWSE_PAGE_TYPES,
	combineFlexColumns,
	EMPTY_SEARCH_RESPONSE,
	parseSearchGenerically,
	PlaylistSearchResult,
	removeEmptyFlexColumns
} from "~/server/types";

interface Response {
	items: PlaylistSearchResult[];
	continuations: string[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return EMPTY_SEARCH_RESPONSE;
	const hasContinuation = query.has("continuation");
	const data = await makeInnerTubeRequest(
		API_ENDPOINTS.search,
		{ query: cleanString(query.get("q")), params: SEARCH_PARAMS.playlists },
		address,
		query.get("continuation")
	);
	if (!data) return EMPTY_SEARCH_RESPONSE;
	const parsed = parseSearchGenerically<BaseRawSearchResult>(data, hasContinuation);

	if (!parsed.length) return EMPTY_SEARCH_RESPONSE;

	const elements = hasContinuation ? parsed[0] : parsed.find((x) => x.title === "Community playlists");
	if (!elements) return EMPTY_SEARCH_RESPONSE;

	return {
		items: elements.contents.map((item) => {
			const columns = removeEmptyFlexColumns(item.flexColumns);
			const combinedColumns = combineFlexColumns(columns);
			let creator: string | undefined = undefined;
			let album: IdentifiedString | undefined = undefined;
			for (const column of combinedColumns) {
				// Can't destructure here
				const pageType = column.navigationEndpoint?.browseEndpoint?.pageType;
				if (pageType === BROWSE_PAGE_TYPES.user) creator = column.text;
				else if (pageType === BROWSE_PAGE_TYPES.album) album = { name: column.text, id: column.navigationEndpoint.browseEndpoint.browseId };
			}
			const name = columns[0][0]?.text;
			return {
				type: "playlist",
				creator,
				name,
				album,
				thumbnails: item.thumbnail.thumbnail.thumbnails,
				id: item.navigationEndpoint.browseEndpoint.browseId
			};
		}),
		continuations: elements.continuations
	};
});
