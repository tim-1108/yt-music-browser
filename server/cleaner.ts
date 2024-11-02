const MAX_STRING_LENGTH = 100;
export const STRING_CLEANER_PATTERNS = {
	WINDOWS_RESERVED_NAMES: /^(con|prn|aux|nul|com1|com2|com3|com4|com5|com6|com7|com8|com9|lpt1|lpt2|lpt3|lpt4|lpt5|lpt6|lpt7|lpt8|lpt9)/i,
	RESERVED_SYMBOLS: /<>:"\/\\\|\?\*/gi
};
export function cleanString(text: string, patterns?: RegExp[]) {
	let adapted = text.substring(0, MAX_STRING_LENGTH).toWellFormed();
	if (patterns) patterns.forEach((pattern) => (adapted = adapted.replace(pattern, "")));
	return adapted;
}
export function removeSizeFromAsset(text?: string) {
	return text?.replace(/(=w\d+-h\d+(-[a-z])?-l\d+-rj)$/i, "");
}
export function mapQueryEntries(query: { [key: string]: string | string[] }) {
	const map = new PrevalidatedMap<string, string>();
	for (const key in query) {
		const value = query[key];
		if (!Array.isArray(value)) {
			if (value.length === 0) continue;
			map.set(key, value);
			continue;
		}
		if (typeof value[0] !== "string") continue;
		map.set(key, value[0]);
	}
	return map;
}

export class PrevalidatedMap<K, V> extends Map<K, V> {
	constructor() {
		super();
	}
	public get(key: K) {
		return super.get(key) as V;
	}
}
