import { startDownload } from "..";
import type { DownloadStartS2DPacket } from "../../common/types";

export default (packet: DownloadStartS2DPacket) => {
	startDownload(packet.data.metadata, packet.data.settings, packet.data.job_id);
};
