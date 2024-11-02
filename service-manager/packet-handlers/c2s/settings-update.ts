import type { ServerWebSocket } from "bun";
import socketClosureCodes from "../../socket_closure_codes.json";
import { validateSchema } from "../../validator";
import { clientSettingsSchema } from "../../types";
import type { ClientSocketData, SettingsUpdateC2SPacket } from "../../../common/types";

export default (ws: ServerWebSocket<ClientSocketData>, packet: SettingsUpdateC2SPacket) => {
	if (!packet.data.settings) return;
	const settingsValidation = validateSchema(clientSettingsSchema, packet.data.settings);
	if (settingsValidation.failed)
		return ws.close(socketClosureCodes.invalid_packet_data, `Client settings invalid: ${settingsValidation.violations.join(", ")}`);
	ws.data.settings = packet.data.settings;
};
