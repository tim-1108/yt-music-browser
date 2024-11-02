import type { AlbumSearchResult, ArtistSearchResult, PlaylistSearchResult, SongSearchResult, VideoSearchResult } from "~/server/types";

export const useSearchQuery = () => useState<Nullable<string>>("search-query", () => null);
export const useSearchFilter = () => useState<SearchFilter>("search-filter", () => "songs");
export type SearchFilter = "songs" | "videos" | "albums" | "playlists" | "artists" | "videos-classic";

export const useSearchResults = () => useState<SearchResults>("search-results", () => structuredClone(EMPTY_SEARCH_RESULTS));
export const useSearchContinuations = () => useState<SearchContinuations>("search-continuations", () => structuredClone(EMPTY_SEARCH_CONTINUATIONS));

export const useSearchingState = () => useState<boolean>("is-searching", () => false);

export type YouFindThatDamnSearchResultType = SongSearchResult | AlbumSearchResult | PlaylistSearchResult | VideoSearchResult | ArtistSearchResult;

interface SearchResults {
	songs: SongSearchResult[];
	albums: AlbumSearchResult[];
	playlists: PlaylistSearchResult[];
	videos: VideoSearchResult[];
	artists: ArtistSearchResult[];
	"videos-classic": VideoSearchResult[];
}

const EMPTY_SEARCH_RESULTS = {
	songs: [],
	albums: [],
	playlists: [],
	videos: [],
	artists: [],
	"videos-classic": []
};

interface SearchContinuations {
	[key: string]: Nullable<string>;
}

const EMPTY_SEARCH_CONTINUATIONS = {
	songs: null,
	albums: null,
	playlists: null,
	videos: null,
	artists: null
};

export function resetSearchResults() {
	useSearchResults().value = structuredClone(EMPTY_SEARCH_RESULTS);
	useSearchContinuations().value = structuredClone(EMPTY_SEARCH_CONTINUATIONS);
}
