import { LyricsData } from "~/common/types";
import { cleanString, mapQueryEntries } from "../cleaner";
import { API_ENDPOINTS } from "../constants";
import { makeInnerTubeRequest } from "../request";
import { BROWSE_PAGE_TYPES, NavigationEndpoint, InnerTubeText, combineTextRuns } from "../types";

type RawNextResponse = {
	title: string;
	/**
	 * This field is only used for the suggestions tab, which we do not care for
	 */
	content: any;
	endpoint?: NavigationEndpoint;
}[];

type RawLyricsResponse = {
	description: InnerTubeText[];
	/**
	 * These properties are not important to this parser, as the description field
	 * always includes all data.
	 */
	maxCollapsedLines: number;
	maxExpandedLines: number;
	/**
	 * The footer contains the source of the lyrics.
	 */
	footer: InnerTubeText[];
}[];

const EMPTY_LYRICS_RESPONSE = {
	lyrics: null,
	source: null
};

export default defineEventHandler<Promise<LyricsData>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("id")) return EMPTY_LYRICS_RESPONSE;
	const nextData = await makeInnerTubeRequest<RawNextResponse>(API_ENDPOINTS.next, { videoId: cleanString(query.get("id")) }, address);
	if (!nextData || !Array.isArray(nextData)) return EMPTY_LYRICS_RESPONSE;

	const lyricsTab = nextData.find((tab) => tab.title === "Lyrics");
	if (!lyricsTab || !lyricsTab.endpoint?.browseEndpoint || lyricsTab.endpoint.browseEndpoint.pageType !== BROWSE_PAGE_TYPES.lyrics)
		return EMPTY_LYRICS_RESPONSE;

	const { browseId } = lyricsTab.endpoint.browseEndpoint;

	const lyricsData = await makeInnerTubeRequest<RawLyricsResponse>(API_ENDPOINTS.browse, { browseId }, address);

	if (!lyricsData || !lyricsData.length) return EMPTY_LYRICS_RESPONSE;

	// The YouTube lyrics API may provide the Windows CLRF style for line wraps
	const lyrics = combineTextRuns(lyricsData[0].description)?.replace(/\r\n/g, "\n") ?? null;
	const source = combineTextRuns(lyricsData[0].footer)?.replace(/Source: /gi, "") ?? null;

	return { lyrics, source };
});
