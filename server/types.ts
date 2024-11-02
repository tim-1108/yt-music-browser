import { IdentifiedString, SizedThumbnail } from "~/common/types";

export type SearchResultType = "album" | "artist" | "song" | "playlist" | "video";

export interface SearchResult {
	type: SearchResultType;
	thumbnails: SizedThumbnail[];
	id: string;
	/**
	 * Present everywhere BUT the artist result (there is no gradient for that)
	 */
	gradient?: string[];
}
export interface AlbumSearchResult extends SearchResult {
	type: "album";
	artists: IdentifiedString[];
	album_type?: string;
	name?: string;
	explicit: boolean;
}
export interface ArtistSearchResult extends SearchResult {
	type: "artist";
	name: string;
}
export interface PlaylistSearchResult extends SearchResult {
	type: "playlist";
	creator?: string;
	album?: IdentifiedString;
	name?: string;
}
export interface SongSearchResult extends SearchResult {
	type: "song";
	artists: IdentifiedString[];
	album?: IdentifiedString;
	name?: string;
	length?: string;
	explicit: boolean;
}
export interface VideoSearchResult extends SearchResult {
	type: "video";
	creators: string[];
	artists: IdentifiedString[];
	name?: string;
	length?: string;
}

export interface RawAlbumListItem {
	thumbnailRenderer: Thumbnail;
	title: InnerTubeText[];
	subtitle: InnerTubeText[];
	navigationEndpoint: NavigationEndpoint;
}

export type TextRuns = InnerTubeText[];

export const EMPTY_SEARCH_RESPONSE = {
	items: [],
	continuations: []
};

export const EMPTY_PLAYLIST_RESPONSE = {
	items: [],
	artists: [],
	type: "",
	thumbnails: [],
	artist_thumbnails: []
};

export const EMPTY_ARTIST_RESPONSE = {
	name: null,
	description: null,
	artist_thumbnails: [],
	popular_songs: {
		list: [],
		playlist_id: null
	},
	albums: []
};

export const VIEWS_PATTERN = /^\d+(\.\d+)?[KMBT] plays$/;

export interface RawArtistHeader {
	title: InnerTubeText[];
	description: InnerTubeText[];
	thumbnail: Thumbnail;
}

export interface InnerTubeText {
	text: string;
	bold?: boolean;
	italic?: boolean;
	// Only present on clickable texts
	navigationEndpoint: NavigationEndpoint;
}

export interface NavigationEndpoint {
	// Assume only the thing we are looking for is present
	searchEndpoint: {
		query: string;
	};
	browseEndpoint: {
		browseId: string;
		pageType: string;
	};
	watchEndpoint: {
		videoId: string;
		playlistId: string;
		params: string;
		musicVideoType: string;
	};
}

export interface Icon {
	iconType: "SEARCH" | "MUSIC_EXPLICIT_BADGE";
}

export interface Thumbnail {
	thumbnail: {
		thumbnails: SizedThumbnail[];
	};
	thumbnailCrop: string;
	thumbnailScale: string;
}

export interface FlexColumn {
	displayPriority: string;
	text: TextRuns;
}

export interface SimpleText {
	simpleText: string;
}

// In reduce, only one property is allowed but it allows going deeper due to that being needed
const NAVIGATION_ENDPOINT_REDUCERS: {
	[key: string]: { initial: string; continuations: string[] };
} = {
	browseEndpoint: {
		initial: "browseEndpointContextSupportedConfigs",
		continuations: ["browseEndpointContextMusicConfig"]
	},
	watchEndpoint: {
		initial: "watchEndpointMusicSupportedConfigs",
		continuations: ["watchEndpointMusicConfig"]
	}
};
const NAVIGATION_ENDPOINT_REDUCER_KEYS = Object.keys(NAVIGATION_ENDPOINT_REDUCERS);
const TRACKING_KEYS = ["clickTrackingParams", "trackingParams"];
/**
 * In these parents, the contents field (even if it's the only one) may not be pushed to the top.
 * There might be cases when there is a continuations field also present on only some items, but not all.
 * Albums have no continuations field, playlists do - and they get parsed the same way!
 */
const NO_CONTENT_MERGERS = ["secondaryContents"];

export function simplifyInnerTubeResponse(data: any, name?: string, parent?: string): any {
	// Any strings, numbers, booleans or other raw values shall be returned as is
	if (!data || typeof data !== "object") return data;
	// If the data is an array, we wish to preserve it
	if (Array.isArray(data)) return data.map((value) => simplifyInnerTubeResponse(value));
	const keys = Object.keys(data);
	// This makes it so we can overwrite things only at need
	let reconstructedData = structuredClone(data);

	const insideNavigationEndpoint = parent === "endpoint" || parent === "navigationEndpoint" || parent === "playNavigationEndpoint";
	const navigationEndpointKey = insideNavigationEndpoint ? NAVIGATION_ENDPOINT_REDUCER_KEYS.find((x) => x === name) : undefined;
	// @ts-ignore
	const props = NAVIGATION_ENDPOINT_REDUCERS[navigationEndpointKey ?? ""];

	// If a renderer has a contents field, we would expect it to only have that
	const isOnlyItem = keys.filter((key) => !TRACKING_KEYS.includes(key)).length === 1;
	for (const key of keys) {
		if (TRACKING_KEYS.includes(key)) {
			delete reconstructedData[key];
			continue;
		}
		const value = data[key];
		// In this case, the data can stay the same way it is in the reconstructed data object
		if (value == undefined) continue;

		if (navigationEndpointKey && props.initial === key) {
			const reduced = props.continuations.reduce((acc, value) => acc[value], value);
			delete reconstructedData[key];
			reconstructedData = { ...reconstructedData, ...reduced };
			continue;
		}

		// Here, we assume that if some data has a runs field set, it is the only field on that, always
		if (key === "runs") {
			// In this, it might be the only item, however, often a accessiblity field is included (but all of that can be ignored)
			reconstructedData = simplifyInnerTubeResponse(value, undefined, parent);
			continue;
		}

		const isRenderer = (key.toLowerCase().endsWith("renderer") || key.toLowerCase().endsWith("continuation")) && isOnlyItem;
		const isContents = ["contents", "tabs"].includes(key) && Array.isArray(value) && isOnlyItem;
		const isContent = key === "content" && isOnlyItem;
		if (isRenderer || isContent) {
			reconstructedData = simplifyInnerTubeResponse(value, name, parent);
			continue;
		}
		if (isContents && !NO_CONTENT_MERGERS.includes(name ?? "")) {
			reconstructedData = value.map((entry) => simplifyInnerTubeResponse(entry, undefined, parent));
			continue;
		}
		reconstructedData[key] = simplifyInnerTubeResponse(value, key, name);
	}
	return reconstructedData;
}

/**
 * The data is structured as following (this is already simplified data):
 *
 * Tab container, with content field (theoretically there could be multiple tabs).
 * Content field contains header (unimportant - only chips) and contents field.
 *
 * First item of contents is "info about search results",
 * second item has a contents field and continuation data needed to fetch more data.
 * This contents field is an array containing all elements from the search
 *
 * @param data InnerTube response which already was simplified
 * @returns
 */
export function parseSearchGenerically<T extends BaseRawSearchResult>(data: any, isContinuation?: boolean): GenericRawSearchResults<T>[] {
	if (!isContinuation) {
		if (!data.length) return [];
		if (!("content" in data[0])) return [];
	}
	// This is a "hotfix" to allow the continuation to be parsed into this
	// The continuation only consists of an object with a contents and continuations field (and some other crap)
	const container = !isContinuation ? data[0].content?.contents : [null, data.contents];
	// Here we except the search to always have the "info" thing
	// In a search, there might also be a "did you mean" box, which would be the second item
	if ((container?.length ?? 0) < 2) return [];
	container.splice(0, 1);
	return container.map((category: any) => {
		const { contents, title } = category;
		const continuations = parseContinuations(category.continuations);
		return { contents, continuations, title: combineTextRuns(title) };
	});
}

export function parseContinuations(continuations: any = []) {
	if (!Array.isArray(continuations)) return [];
	return continuations.map((entry) => entry.nextContinuationData).filter((entry) => typeof entry === "string");
}

export interface BaseRawSearchResult {
	// There are MANY other properties, however they are really irrelevant for us
	flexColumns: FlexColumn[];
	thumbnail: Thumbnail;
	navigationEndpoint: NavigationEndpoint;
	// Is not present on everything, only stuff like explicit
	badges?: InnerTubeBadge[];
	/**
	 * Important: This is not present on artist search results
	 */
	overlay: {
		background: {
			verticalGradient: {
				gradientLayerColors: string[];
			};
		};
	};
}

export interface Album {
	id: string;
	title?: string;
	album_type?: string;
	release?: string;
	thumbnails?: SizedThumbnail[];
}

export interface InnerTubeBadge {
	// In here would also be accessibilityData, i.e. to show some text
	// => not important
	icon: Icon;
}

export interface SongsRawSearchResult extends BaseRawSearchResult {
	playlistItemData: {
		videoId: string;
	};
}

export interface GenericRawSearchResults<T extends BaseRawSearchResult> {
	contents: T[];
	continuations: string[];
	title: string;
}

export function combineTextRuns(text: InnerTubeText[] = []) {
	if (!text) return undefined;
	return text.map((entry) => entry.text).join(" ");
}

const EMPTY_COLUMN_ENTRY = " • ";
export function removeEmptyFlexColumns(flexColumns: FlexColumn[]) {
	return flexColumns.map((column) => (Array.isArray(column?.text) ? removeEmptyInnerTubeTexts(column.text) : []));
}

export function removeEmptyInnerTubeTexts(runs: InnerTubeText[]) {
	return runs.filter((run) => run.text !== EMPTY_COLUMN_ENTRY);
}

export function combineFlexColumns(columns: InnerTubeText[][]) {
	return new Array<InnerTubeText>().concat(...columns);
}

export const BROWSE_PAGE_TYPES = {
	artist: "MUSIC_PAGE_TYPE_ARTIST",
	album: "MUSIC_PAGE_TYPE_ALBUM",
	playlist: "MUSIC_PAGE_TYPE_PLAYLIST",
	podcast: "MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE",
	user: "MUSIC_PAGE_TYPE_USER_CHANNEL",
	lyrics: "MUSIC_PAGE_TYPE_TRACK_LYRICS"
};

export function isSearchResultExplicit(item: BaseRawSearchResult) {
	return Array.isArray(item.badges) && item.badges.some((badge) => badge.icon.iconType === "MUSIC_EXPLICIT_BADGE");
}

export function getGradientFromRawSearchResult(item: BaseRawSearchResult) {
	if (!item.overlay) return;
	return item.overlay.background?.verticalGradient?.gradientLayerColors?.map((color) => "0x" + parseInt(color).toString(16)) ?? undefined;
}

export type InnerTubeContinuations = { nextContinuationData: string }[];

export interface RawPlaylistResponse {
	secondaryContents: {
		contents: {
			contents: RawPlaylistItem[];
			playlistId?: string;
			collapsedItemCount?: number;
		}[];
		continuations: InnerTubeContinuations;
	};
	tabs: RawPlaylistTab[][];
}

export interface RawPlaylistTab {
	thumbnail: Thumbnail;
	title: InnerTubeText[];
	subtitle: InnerTubeText[];
	straplineTextOne: InnerTubeText[];
	straplineThumbnail: Thumbnail;
	description: {
		description: InnerTubeText[];
	};
	secondSubtitle: InnerTubeText[];
}

export interface RawPlaylistItem {
	thumbnail: Thumbnail;
	flexColumns: FlexColumn[];
	fixedColumns: FlexColumn[];
	playlistItemData: {
		playlistSetVideoId: string;
		videoId: string;
	};
	/**
	 * Only present on albums, not on normal playlists
	 */
	index: InnerTubeText[];
}

export function parseRawPlaylistItem(item: RawPlaylistItem) {
	const thumbnails = item.thumbnail?.thumbnail?.thumbnails;
	const columns = removeEmptyFlexColumns(item.flexColumns);
	const combinedColumns = combineFlexColumns(columns);

	const creators: string[] = [];
	const artists: IdentifiedString[] = [];
	let album: IdentifiedString | undefined = undefined;
	let watchData: InnerTubeText | undefined = undefined;

	const length = "fixedColumns" in item ? item.fixedColumns[0]?.text[0]?.text : undefined;
	const views = combinedColumns.find((column) => VIEWS_PATTERN.test(column.text))?.text;

	for (const column of combinedColumns) {
		if (column.navigationEndpoint?.browseEndpoint) {
			const { pageType } = column.navigationEndpoint.browseEndpoint;
			switch (pageType) {
				case BROWSE_PAGE_TYPES.album: {
					album = { name: column.text, id: column.navigationEndpoint.browseEndpoint.browseId };
					break;
				}
				case BROWSE_PAGE_TYPES.artist: {
					artists.push({ id: column.navigationEndpoint.browseEndpoint.browseId, name: column.text });
					break;
				}
				case BROWSE_PAGE_TYPES.user: {
					creators.push(column.text);
					break;
				}
			}
		} else if (column.navigationEndpoint?.watchEndpoint) watchData = column;
	}

	const videoId = watchData?.navigationEndpoint.watchEndpoint?.videoId;
	if (!videoId) return null;

	return {
		id: videoId,
		name: watchData?.text,
		artists,
		creators,
		album,
		thumbnails,
		length,
		views
	};
}

export const patterns = {
	musixmatchToken: /^[a-z0-9]{54}$/,
	cookieReplacement: /;(path|samesite|secure|max-age)(=[^;]*)?/gi
};
