export const useLegalState = () =>
	useCookie<"yes" | "no">("legal-confirmation", {
		expires: inOneYear(),
		default: () => "no"
	});

function inOneYear() {
	const object = new Date();
	object.setTime(Date.now() + 1000 * 60 * 60 * 24 * 365);
	return object;
}
