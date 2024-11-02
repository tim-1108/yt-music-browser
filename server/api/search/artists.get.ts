import { cleanString, mapQueryEntries } from "~/server/cleaner";
import { API_ENDPOINTS, SEARCH_PARAMS } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import { ArtistSearchResult, BaseRawSearchResult, EMPTY_SEARCH_RESPONSE, parseSearchGenerically, removeEmptyFlexColumns } from "~/server/types";

interface Response {
	items: ArtistSearchResult[];
	continuations: string[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return EMPTY_SEARCH_RESPONSE;
	const hasContinuation = query.has("continuation");
	const data = await makeInnerTubeRequest(
		API_ENDPOINTS.search,
		{ query: cleanString(query.get("q")), params: SEARCH_PARAMS.artists },
		address,
		query.get("continuation")
	);
	if (!data) return EMPTY_SEARCH_RESPONSE;
	const parsed = parseSearchGenerically<BaseRawSearchResult>(data, hasContinuation);

	if (!parsed.length) return EMPTY_SEARCH_RESPONSE;

	const elements = hasContinuation ? parsed[0] : parsed.find((x) => x.title === "Artists");
	if (!elements) return EMPTY_SEARCH_RESPONSE;

	return {
		items: elements.contents.map((item) => {
			const columns = removeEmptyFlexColumns(item.flexColumns);
			const name = columns[0][0]?.text;
			return {
				type: "artist",
				name,
				thumbnails: item.thumbnail.thumbnail.thumbnails,
				id: item.navigationEndpoint.browseEndpoint.browseId
			};
		}),
		continuations: elements.continuations
	};
});
