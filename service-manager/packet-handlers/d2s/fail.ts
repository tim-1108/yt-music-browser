import type { ServerWebSocket } from "bun";
import { deleteJob } from "../..";
import { createClientboundPacket } from "../../packets";
import { clients, jobs } from "../../storage";
import type { DownloaderSocketData, DownloadFailD2SPacket, JobDownloadFailS2CPacket } from "../../../common/types";

export default (ws: ServerWebSocket<DownloaderSocketData>, packet: DownloadFailD2SPacket) => {
	const job = jobs.get(packet.data.job_id);
	if (!job) return console.warn("Recieved fail packet for unknown job from downloader");
	const client = clients.get(job.session_id);
	if (!client) return console.warn("Found job but session is gone");
	client.send(createClientboundPacket<JobDownloadFailS2CPacket>("job-download-fail", { job_id: job.job_id, reason: packet.data.reason }));
	ws.data.current_download = null;
	job.assigned_downloader = null;
	deleteJob(packet.data.job_id);
};
