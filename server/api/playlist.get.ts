import { PlaylistItem, IdentifiedString, SizedThumbnail } from "~/common/types";
import { cleanString, mapQueryEntries } from "../cleaner";
import { API_ENDPOINTS } from "../constants";
import { makeInnerTubeRequest } from "../request";
import { BROWSE_PAGE_TYPES, EMPTY_PLAYLIST_RESPONSE, RawPlaylistResponse, parseRawPlaylistItem } from "../types";

interface Response {
	items: PlaylistItem[];
	artists: IdentifiedString[];
	title?: string;
	type: string;
	release?: string;
	thumbnails: SizedThumbnail[];
	artist_thumbnails: SizedThumbnail[];
}

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("id")) return EMPTY_PLAYLIST_RESPONSE;
	const data = await makeInnerTubeRequest<RawPlaylistResponse, undefined>(
		API_ENDPOINTS.browse,
		{ browseId: cleanString(query.get("id")) },
		address
	);
	if (!data) return EMPTY_PLAYLIST_RESPONSE;

	if (!data.secondaryContents) return EMPTY_PLAYLIST_RESPONSE;

	const items = data.secondaryContents.contents[0].contents.map(parseRawPlaylistItem).filter((x) => x !== null);
	const metadata = data.tabs[0][0];
	if (!metadata) return EMPTY_PLAYLIST_RESPONSE;
	const artists = Array.isArray(metadata.straplineTextOne)
		? metadata.straplineTextOne
				.filter((text) => text.navigationEndpoint?.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.artist)
				.map((artist) => ({ name: artist.text, id: artist.navigationEndpoint.browseEndpoint.browseId }))
		: [];
	const title = metadata.title.map((x) => x.text).join("");
	const type = metadata.subtitle[0]?.text;
	const release = metadata.subtitle[2]?.text;
	const artist_thumbnails = metadata.straplineThumbnail?.thumbnail?.thumbnails;
	const thumbnails = metadata.thumbnail.thumbnail?.thumbnails;
	return { items, artists, title, type, release, artist_thumbnails, thumbnails };
});
