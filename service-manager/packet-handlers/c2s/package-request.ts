import type { ServerWebSocket } from "bun";
import { startPackagingSession } from "../..";
import type { ClientSocketData, PackageRequestC2SPacket } from "../../../common/types";

export default (ws: ServerWebSocket<ClientSocketData>, packet: PackageRequestC2SPacket) => {
	startPackagingSession(ws);
};
