import type { ServerWebSocket } from "bun";
import { createClientboundPacket } from "../../packets";
import { clients, jobs } from "../../storage";
import type { DownloaderSocketData, DownloadFinishD2SPacket, JobDownloadStatusS2CPacket } from "../../../common/types";

export default async (ws: ServerWebSocket<DownloaderSocketData>, packet: DownloadFinishD2SPacket) => {
	const job = jobs.get(packet.data.job_id);
	if (!job) return console.warn("Recieved finish packet for unknown job from downloader");
	const client = clients.get(job.session_id);
	if (!client) return console.warn("Found job but session is gone");

	// We just want to notify the client before all hell breaks loose
	client.send(
		createClientboundPacket<JobDownloadStatusS2CPacket>("job-download-status", { job_id: packet.data.job_id, status_string: "Finishing up" })
	);
};
