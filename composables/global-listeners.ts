export function registerWindowListener<K extends keyof WindowEventMap>(
	type: K,
	listener: (event: WindowEventMap[K]) => any,
	options?: NoSignalAddEventListenerOptions
) {
	if (!(globalThis instanceof Window)) {
		console.warn("Could not create a window listener");
		return null;
	}
	return registerListener(globalThis, type, listener as GenericListener, options);
}

export function registerDocumentListener<K extends keyof DocumentEventMap>(
	type: K,
	listener: (event: DocumentEventMap[K]) => any,
	options?: NoSignalAddEventListenerOptions
) {
	if (!(globalThis.document instanceof Document)) {
		console.warn("Could not create a document listener");
		return null;
	}
	return registerListener(globalThis.document, type, listener as GenericListener, options);
}

function registerListener<T extends EventTarget, M extends Record<string, Event>, K extends keyof M & string>(
	object: T,
	type: K,
	listener: (event: M[K]) => any,
	options?: NoSignalAddEventListenerOptions
) {
	console.debug("Registered event listener for type", type, "for", object, "with options", options);
	const controller = new AbortController();
	object.addEventListener(type, listener as EventListener, { ...options, signal: controller.signal });
	return controller.abort;
}

type GenericListener = (event: Event) => any;
type NoSignalAddEventListenerOptions = Omit<AddEventListenerOptions, "signal">;
