import type { VideoID } from "~/common/types";

export const useEmbeddedVideo = () => useState<VideoID | null>("embedded-video", () => null);
