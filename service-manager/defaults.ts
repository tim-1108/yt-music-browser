import type { AudioBitrate, SponsorblockSegment } from "../common/types";

export const DEFAULT_CLIENT_SETTINGS = {
	useAlbumSubfolders: true,
	audioBitrate: 0 as AudioBitrate,
	useSponsorblock: true,
	sponsorblockSegments: ["music_offtopic"] as SponsorblockSegment[],
	useMaxResCovers: true,
	autoPackageOnFinish: false,
	saveLyrics: true
};
