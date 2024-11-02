import { Nullable } from "~/composables/types";
import { cleanString, mapQueryEntries } from "../cleaner";
import { API_ENDPOINTS } from "../constants";
import { makeInnerTubeRequest } from "../request";
import {
	BROWSE_PAGE_TYPES,
	EMPTY_ARTIST_RESPONSE,
	InnerTubeText,
	RawPlaylistItem,
	parseRawPlaylistItem,
	RawAlbumListItem,
	removeEmptyInnerTubeTexts,
	Album,
	RawArtistHeader,
	combineTextRuns
} from "../types";
import { PlaylistItem, SizedThumbnail } from "~/common/types";

type RawArtistResponse = [ArtistShelf[]];

interface ArtistShelf {
	// The songs shelf has the title field, while others (where there are buttons and such) have the header field
	title: InnerTubeText[];
	header: {
		title: InnerTubeText[];
	};
	// Does not include the fixedColumns nor the index for this API endpoint
	contents: RawPlaylistItem[] | RawAlbumListItem[];
}

interface RawAlbumListResponse {
	contents: [
		{
			contents: [
				{
					items: RawAlbumListItem[];
				}
			];
		}
	];
}

interface Response {
	name: Nullable<string>;
	description: Nullable<string>;
	artist_thumbnails: SizedThumbnail[];
	popular_songs: {
		list: PlaylistItem[];
		playlist_id: Nullable<string>;
	};
	albums: Album[];
}

/**
 * All these values of the title of a shelf would give us the browseId for the whole list of albums.
 * So if the artist has not released any albums xor any singles, either way, we would find that whole list.
 */
const ALBUM_LIKE_TITLES = ["Albums", "Singles"];

export default defineEventHandler<Promise<Response>>(async (event) => {
	const address = getRequestIP(event, { xForwardedFor: true });
	const query = mapQueryEntries(getQuery(event));
	if (!query.has("id")) return EMPTY_ARTIST_RESPONSE;
	const data = await makeInnerTubeRequest<RawArtistResponse, RawArtistHeader>(
		API_ENDPOINTS.browse,
		{ browseId: cleanString(query.get("id")) },
		address
	);
	if (!data) return EMPTY_ARTIST_RESPONSE;

	const name = data.header?.title[0]?.text ?? null;
	const description = combineTextRuns(data.header?.description) ?? null;
	const artist_thumbnails = data.header?.thumbnail.thumbnail.thumbnails ?? [];

	const shelfs = data.contents[0];
	if (!Array.isArray(shelfs)) return EMPTY_ARTIST_RESPONSE;

	const songsShelf = shelfs.find((shelf) => "title" in shelf && shelf.title[0]?.text === "Songs");
	// The list of songs is just a link to a playlist. If the button at the bottom would be pressed,
	// a param would be given so that YT sends a compressed UI layout
	const songPlaylistId = songsShelf ? songsShelf.title[0].navigationEndpoint?.browseEndpoint?.browseId : null;
	const songs = songsShelf ? (songsShelf.contents as RawPlaylistItem[]).map(parseRawPlaylistItem).filter((x) => x !== null) : [];

	const responseWithoutAlbums = {
		name,
		description,
		artist_thumbnails,
		popular_songs: {
			list: songs,
			playlist_id: songPlaylistId
		},
		albums: []
	};

	const albumsShelf = shelfs.find((shelf) => shelf.header?.title && shelf.header.title[0]?.text === "Albums");
	const singlesShelf = shelfs.find((shelf) => shelf.header?.title && shelf.header.title[0]?.text === "Singles");

	// Both shelfs may be overflowing and giving us a browse endpoint ID for the whole list. Both would be the same browseId
	const albumsBrowseId = [albumsShelf, singlesShelf]
		.map((shelf) => shelf?.header.title[0]?.navigationEndpoint?.browseEndpoint?.browseId)
		.filter((x) => x)[0];
	// In such a case, the artist has too few albums to allow a redirect to another menu.
	// Thus, we need to read all albums from this site directly
	if (!albumsBrowseId) {
		const albums = albumsShelf ? (albumsShelf.contents as RawAlbumListItem[]).map((album) => parseRawAlbumListItem(album)) : [];
		const singles = singlesShelf ? (singlesShelf.contents as RawAlbumListItem[]).map((album) => parseRawAlbumListItem(album, true)) : [];
		return {
			...responseWithoutAlbums,
			albums: new Array<Album>().concat(albums, singles)
		};
	}

	const albumData = await makeInnerTubeRequest<RawAlbumListResponse>(API_ENDPOINTS.browse, { browseId: albumsBrowseId }, address);
	const rawAlbums = albumData ? (albumData.contents[0].contents[0]?.items ?? []) : [];
	const albums = rawAlbums.map((album) => parseRawAlbumListItem(album));

	return {
		...responseWithoutAlbums,
		albums
	};
});

function parseRawAlbumListItem(album: RawAlbumListItem, isSingleList?: boolean) {
	const thumbnails = album.thumbnailRenderer?.thumbnail.thumbnails;
	const subtitle = removeEmptyInnerTubeTexts(album.subtitle);
	const titleRun = album.title.find((element) => element.navigationEndpoint?.browseEndpoint?.pageType === BROWSE_PAGE_TYPES.album);
	const title = titleRun?.text;
	const id = titleRun?.navigationEndpoint.browseEndpoint.browseId!;
	const album_type = isSingleList ? "Single" : subtitle[0]?.text;
	const release = subtitle[isSingleList ? 0 : 1]?.text;
	return {
		id,
		title,
		album_type,
		release,
		thumbnails
	};
}
