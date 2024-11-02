import type { ServerWebSocket } from "bun";
import type { ClientSocketData, QueueRemoveC2SPacket, QueueRemoveConfirmS2CPacket } from "../../../common/types";
import { patterns, pushQueueIntoDownloaders } from "../..";
import { jobs, queue } from "../../storage";
import { createClientboundPacket } from "../../packets";

export default (ws: ServerWebSocket<ClientSocketData>, packet: QueueRemoveC2SPacket) => {
	const { job_id } = packet.data;
	if (!patterns.uuid.test(job_id)) return;
	const job = jobs.get(job_id);
	if (!job || job.queue_position === null) return;
	jobs.delete(job_id);
	queue.splice(job.queue_position, 1);
	pushQueueIntoDownloaders();
	ws.send(createClientboundPacket<QueueRemoveConfirmS2CPacket>("queue-remove-confirm", { job_id }));
};
