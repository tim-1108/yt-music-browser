import type { ServerWebSocket } from "bun";
import { createClientboundPacket } from "../../packets";
import { clients, jobs } from "../../storage";
import type { DownloaderSocketData, DownloadStartConfirmD2SPacket, JobDownloadStartS2CPacket } from "../../../common/types";

export default (ws: ServerWebSocket<DownloaderSocketData>, packet: DownloadStartConfirmD2SPacket) => {
	const job = jobs.get(packet.data.job_id);
	if (!job) return console.warn("Recieved start-confirm packet for unknown job from downloader");
	const client = clients.get(job.session_id);
	if (!client) return console.warn("Found job but session is gone");
	client.send(createClientboundPacket<JobDownloadStartS2CPacket>("job-download-start", { job_id: job.job_id }));
	job.pending_download = false;
};
