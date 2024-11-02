import type { BaseClientboundPacket, BaseDownloaderboundPacket, BaseServerboundClientPacket, BaseServerboundDownloaderPacket } from "../common/types";

export function isServerboundClientPacketOfType<T extends BaseServerboundClientPacket<any, any>>(packet: any, id: T["id"]): packet is T {
	return packet.id === id;
}
export function isServerboundDownloaderPacketOfType<T extends BaseServerboundDownloaderPacket<any, any>>(packet: any, id: T["id"]): packet is T {
	return packet.id === id;
}

export function createDownloaderboundPacket<T extends BaseDownloaderboundPacket<any, any>>(id: T["id"], data: T["data"] = {}) {
	return JSON.stringify({ id, data });
}
export function createClientboundPacket<T extends BaseClientboundPacket<any, any>>(id: T["id"], data: T["data"] = {}) {
	return JSON.stringify({ id, data });
}
