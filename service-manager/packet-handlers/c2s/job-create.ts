import type { ServerWebSocket } from "bun";
import { pushQueueIntoDownloaders } from "../..";
import { createClientboundPacket } from "../../packets";
import { validateSchema } from "../../validator";
import { videoMetadataSchema } from "../../types";
import { jobs, queue } from "../../storage";
import config from "../../config.json";
import type { ClientSocketData, JobCreateC2SPacket, JobRejectionS2CPacket, JobAcceptS2CPacket } from "../../../common/types";

export default (ws: ServerWebSocket<ClientSocketData>, packet: JobCreateC2SPacket) => {
	const metadataValidation = validateSchema(videoMetadataSchema, packet.data);
	if (metadataValidation.failed)
		return ws.send(
			createClientboundPacket<JobRejectionS2CPacket>("job-rejection", {
				video_id: packet.data.video_id,
				violations: metadataValidation.violations
			})
		);

	const videoAlreadyRequested = config.allowSameVideoMultipleTimes
		? false
		: Array.from(jobs.values()).some((job) => job.session_id === ws.data.session_id && job.metadata.video_id === packet.data.video_id);
	if (videoAlreadyRequested)
		return ws.send(
			createClientboundPacket<JobRejectionS2CPacket>("job-rejection", {
				video_id: packet.data.video_id,
				violations: ["Video already requested"]
			})
		);

	const jobId = crypto.randomUUID();

	const newLength = queue.push(jobId);
	jobs.set(jobId, {
		assigned_downloader: null,
		pending_download: false,
		queue_position: newLength - 1,
		job_id: jobId,
		session_id: ws.data.session_id,
		metadata: packet.data,
		paused: false,
		finished: false,
		artist_folder: packet.data.artist_folder,
		album_folder: packet.data.album_folder,
		lyrics: packet.data.lyrics,
		synced_lyrics: packet.data.synced_lyrics
	});

	ws.send(
		createClientboundPacket<JobAcceptS2CPacket>("job-accept", {
			video_id: packet.data.video_id,
			job_id: jobId,
			queue_position: newLength - 1
		})
	);

	ws.data.jobs.push(jobId);

	pushQueueIntoDownloaders(true);
};
