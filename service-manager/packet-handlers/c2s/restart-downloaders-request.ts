import type { ServerWebSocket } from "bun";
import type {
	ClientSocketData,
	RestartDownloadersRequestC2SPacket,
	RestartDownloadersResponseS2CPacket,
	RestartS2DPacket
} from "../../../common/types";
import { downloaders } from "../../storage";
import { createClientboundPacket, createDownloaderboundPacket } from "../../packets";

let lastRequested = 0;
const MIN_INTERVAL = 1000 * 60;

export default (ws: ServerWebSocket<ClientSocketData>, packet: RestartDownloadersRequestC2SPacket) => {
	const now = Date.now();
	const isNotEarly = now - lastRequested >= MIN_INTERVAL;
	const isValid = typeof process.env.AUTH === "string" && packet.data.auth === process.env.AUTH;
	lastRequested = now;
	ws.send(createClientboundPacket<RestartDownloadersResponseS2CPacket>("restart-downloaders-response", { restarting: isNotEarly && isValid }));
	if (!isNotEarly || !isValid) return;
	for (const downloader of downloaders.values()) {
		if (downloader.readyState !== WebSocket.OPEN) continue;
		downloader.send(createDownloaderboundPacket<RestartS2DPacket>("restart"));
	}
};
