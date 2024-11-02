import type { UUID } from "~/service-downloader";

/**
 * This exists in case the socket should get disconnected
 */
interface StoredSocketData {
	session_id: UUID;
	/** Set this to 0 if there is no disconnect yet */
	connection_lost_timestamp: number;
	/** This field is in seconds, as sent via the welcome packet */
	session_timeout: number;
}

export function writeStoredSocketData() {
	const data = useWebSocketData();
	writeJSONToLocalStorage<StoredSocketData>("socket-data", {
		session_id: data.value.session_id as UUID,
		connection_lost_timestamp: Date.now(),
		session_timeout: data.value.config?.sessionRecoveryTimeout ?? 0
	});
}
export const useRecoveryAttemptState = () => useState("is-recovery-attempt", () => false);
export function generateSessionRecovery() {
	const settings = useSettings();
	if (!settings.value.shouldAttemptSessionRecovery) return null;
	const storedData = readJSONFromLocalStorage<StoredSocketData>("socket-data");
	if (storedData === null) return null;
	// This is ony a rudimentary check, but we do not expect anybody to mess with that data.
	// And if they do - well, that is their problem.
	const isValid = objectHasAllProperties<StoredSocketData>(storedData, ["session_id", "connection_lost_timestamp", "session_timeout"]);
	if (!isValid) return null;
	const isWithinTime = Date.now() - storedData.connection_lost_timestamp < storedData.session_timeout * 1000;
	if (!isWithinTime) return null;
	useRecoveryAttemptState().value = true;
	return storedData.session_id;
}

export function removeStoredSocketData() {
	window.localStorage.removeItem("socket-data");
}

/**
 * This function is called when the welcome packet is received.
 * As the packet includes the SID, we can easily check if the old session was restored
 * or a new one has been assigned.
 */
export function checkIfSessionWasRecovered(sessionId: UUID) {
	const recoveryState = useRecoveryAttemptState();
	// This was not even a recovery attempt
	if (!recoveryState.value) return;
	// We only "generate" it so we can compare the stored data against the we just got from the server
	const recoveryData = generateSessionRecovery();
	// In this case, our session was sucessfully restored!
	if (sessionId === recoveryData) {
		addNotification({ title: "Session restored", timeout: 2 });
		// If this session should fail AGAIN at some point, we can attempt to restore again
		recoveryState.value = false;
		return;
	}
	// Our session wasn't restored and we have gotten a new session
	recoveryState.value = false;
	removeStoredSocketData();
	addNotification({ title: "Could not restore session", timeout: 2 });
}
