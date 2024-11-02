import type { UUID } from "~/common/types";

export const useNotifications = () => useState("notifications", () => new Map<UUID, WebNotification>());

export interface WebNotification {
	title: string;
	description?: string;
	timeout?: number;
	actions?: {
		name: string;
		callback: () => Promise<any>;
	}[];
}

export async function addNotification(item: WebNotification) {
	const notifications = useNotifications();
	const id = generateUUID();
	notifications.value.set(id, item);
}
