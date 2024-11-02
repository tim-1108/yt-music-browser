import type { ExtendedVideoInfo, VideoID } from "~/common/types";

export const useMetadataEdits = () => useState("metadata-editor-list", () => new Map<VideoID, ExtendedVideoInfo>());
export const useEditState = () => useState("metadata-editor-state", () => false);

export function addToMetadataEditor(items: ExtendedVideoInfo[], open?: boolean) {
	const list = useMetadataEdits();
	const clonedList = structuredClone(
		toRaw(
			items.map(({ metadata, album, artists, length }) => {
				const rawMetadata = toRaw(metadata);
				// As this is an array, the proxy is kept
				rawMetadata.artists = toRaw(metadata.artists);
				return {
					// All these are proxies and in order for structuredClone to work,
					// the raw value has to be gotten directly.
					metadata: rawMetadata,
					album: structuredClone(toRaw(album)),
					artists: structuredClone(toRaw(artists)),
					length
				};
			})
		)
	);

	for (const item of clonedList) {
		// If something is overwritten here, it is the fault of the user (for adding it twice)
		list.value.set(item.metadata.video_id, item);
	}
	if (open) useEditState().value = true;
}

export function clearMetadataEditor() {
	useThumbnailChooser().value = null;
	useMetadataEdits().value.clear();
}

/**
 * Takes in the video length supplied by YouTube (hours:minutes:seconds) and converts
 * it to seconds as a number. Used for estimating how long audio extraction will take.
 * @param length The video length as a string
 * @returns The length in seconds
 */
export function parseVideoLength(length?: string) {
	if (!length) return undefined;
	// There is also reduceRight, but using that would not give us access to the index we care about
	// We use the index to get the multiplication we need for hours and minutes
	return length
		.split(":")
		.reverse()
		.reduce((acc, value, index) => acc + parseInt(value) * Math.pow(60, index), 0);
}
