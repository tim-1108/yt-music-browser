function b64ToHex(input: string, split: boolean = false) {
	const buffer = Buffer.from(input, "base64");
	const hexxed = buffer.toString("hex");
	if (!split) return hexxed;
	return hexxed
		.split("")
		.map((char, index, array) => {
			if (index % 2 !== 0) return;
			return char + array[index + 1];
		})
		.filter((x) => x !== undefined)
		.join(" ");
}

function hexToB64(input: string) {
	const buffer = Buffer.from(input.replace(/ /g, ""), "hex");
	return buffer.toString("base64");
}
