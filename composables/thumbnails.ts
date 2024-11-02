import type { SizedThumbnail, VideoID } from "~/common/types";

export const THUMBNAIL_RESOLUTIONS = {
	small: 50,
	medium: 200,
	large: 400
};

export function findThumbnailForResolution(thumbnails?: SizedThumbnail[], desired?: number) {
	if (!Array.isArray(thumbnails) || typeof desired !== "number") return undefined;
	const distances = thumbnails.map((thumbnail, index) => ({ distance: Math.abs(desired - thumbnail.height), index }));
	return thumbnails[distances.sort((a, b) => a.distance - b.distance).at(0)?.index ?? 0];
}

/**
 * The thumbnail chooser for setting custom thumbnails on videos for download.
 * -1 indicates that the user is not choosing, any other number the index of the video in the edit list
 * A string value is the url to the image in question.
 */
export const useThumbnailChooser = () => useState<VideoID | null>("thumbnail-chooser", () => null);
