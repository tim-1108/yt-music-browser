import type { InitS2DPacket } from "../../common/types";
import { globalSettings } from "../storage";

export default (packet: InitS2DPacket) => {
	globalSettings.set("max-audio-length", packet.data.maxAudioLength);
};
