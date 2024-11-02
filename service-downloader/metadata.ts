const ESCAPABLE_CHARACTERS = ["\\", '"'];

export function createMetadata(key: "title" | "album" | "artist" | "track", value: string | undefined) {
	if (typeof value !== "string" || value === "") return `-metadata "${key}="`;
	const escaped = ESCAPABLE_CHARACTERS.reduce((text, character) => text.replaceAll(character, "\\" + character), value);
	return `-metadata "${key}=${escaped}"`;
}
