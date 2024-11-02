let lastPing = 0;
const MIN_INTERVAL = 1000 * 60;
import type { ServerWebSocket } from "bun";
import type { ClientSocketData, PingDownloadersC2SPacket } from "../../../common/types";
import downloaders from "../../downloaders.json";

export default (ws: ServerWebSocket<ClientSocketData>, packet: PingDownloadersC2SPacket) => {
	const now = Date.now();
	if (now - lastPing < MIN_INTERVAL) return;
	for (const downloader of downloaders) {
		fetch(downloader);
	}
};
