import { SizedThumbnail } from "~/common/types";
import { cleanString, mapQueryEntries } from "~/server/cleaner";
import { API_ENDPOINTS } from "~/server/constants";
import { makeInnerTubeRequest } from "~/server/request";
import {
	combineTextRuns,
	EMPTY_SEARCH_RESPONSE,
	InnerTubeContinuations,
	InnerTubeText,
	parseContinuations,
	SimpleText,
	VideoSearchResult
} from "~/server/types";

interface Response {
	items: VideoSearchResult[];
	continuations: string[];
}

interface BaseClassicAPISearchResponse {
	primaryContents: {
		contents: VideoContent[][];
		continuations?: InnerTubeContinuations;
	};
	// These fields only exist on continuations, with primary being not there
	contents: VideoContent[][];
	continuations?: InnerTubeContinuations;
}

interface VideoContent {
	videoId: string;
	thumbnail: {
		thumbnails: SizedThumbnail[];
	};
	title: InnerTubeText[];
	lengthText: SimpleText;
	ownerText: InnerTubeText[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("q")) return EMPTY_SEARCH_RESPONSE;
	const hasContinuation = query.has("continuation");
	const data = await makeInnerTubeRequest<BaseClassicAPISearchResponse>(
		API_ENDPOINTS.search,
		{ query: cleanString(query.get("q")), params: "EgIQAQ%3D%3D" },
		address,
		query.get("continuation"),
		true
	);
	if (!data || (!data.primaryContents && !hasContinuation)) return EMPTY_SEARCH_RESPONSE;
	const continuations = parseContinuations(hasContinuation ? data.continuations : data.primaryContents.continuations);
	const content = hasContinuation ? data.contents[0] : data.primaryContents.contents[0];
	if (!content.length || !content[0].videoId) return EMPTY_SEARCH_RESPONSE;
	const items = content
		.map((element) => {
			if (!element.videoId) return null;
			return {
				type: "video",
				id: element.videoId,
				thumbnails: element.thumbnail.thumbnails,
				creators: [combineTextRuns(element.ownerText)],
				artists: [],
				name: combineTextRuns(element.title),
				length: element.lengthText?.simpleText
			} as VideoSearchResult;
		})
		.filter((entry) => entry !== null);
	return {
		items,
		continuations
	};
});
