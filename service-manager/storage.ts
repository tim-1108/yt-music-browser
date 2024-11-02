import type { ServerWebSocket } from "bun";
import type { UUID, DownloadJob, ClientSocketData, DownloaderSocketData } from "../common/types";

export const jobs = new Map<UUID, DownloadJob>();
export const queue: UUID[] = [];
export const clients = new Map<UUID, ServerWebSocket<ClientSocketData>>();
export const downloaders = new Map<UUID, ServerWebSocket<DownloaderSocketData>>();
export const restorableSessions: UUID[] = [];
export const sessionRecoveryTimeouts = new Map<UUID, Timer>();
