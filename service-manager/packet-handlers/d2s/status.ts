import type { ServerWebSocket } from "bun";
import { createClientboundPacket } from "../../packets";
import { clients, jobs } from "../../storage";
import type { DownloaderSocketData, DownloadStatusD2SPacket, JobDownloadStatusS2CPacket } from "../../../common/types";

export default (ws: ServerWebSocket<DownloaderSocketData>, packet: DownloadStatusD2SPacket) => {
	const job = jobs.get(packet.data.job_id);
	if (!job) return console.warn("Recieved status packet for unknown job from downloader");
	const client = clients.get(job.session_id);
	if (!client) return console.warn("Found job but session is gone");
	client.send(createClientboundPacket<JobDownloadStatusS2CPacket>("job-download-status", packet.data));
};
