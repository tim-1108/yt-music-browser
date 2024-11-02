import type { BaseDownloaderboundPacket, BaseServerboundDownloaderPacket } from "../common/types";

export function createServerboundPacket<T extends BaseServerboundDownloaderPacket<any, any>>(id: T["id"], data: T["data"]) {
	return JSON.stringify({ id, data });
}

export function isDownloaderboundPacketOfType<T extends BaseDownloaderboundPacket<any, any>>(packet: any, id: T["id"]): packet is T {
	return packet.id === id;
}
