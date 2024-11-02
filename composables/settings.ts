import type { ClientSettings } from "~/common/types";

const DEFAULT_SETTINGS: Omit<ClientSettings, "version"> = {
	useAlbumSubfolders: true,
	audioBitrate: 0,
	useSponsorblock: true,
	sponsorblockSegments: ["music_offtopic"],
	useMaxResCovers: true,
	autoPackageOnFinish: false,
	shouldAttemptSessionRecovery: true,
	saveLyrics: true
};

export function createSettings() {
	const settings = structuredClone({ ...DEFAULT_SETTINGS, version: useRuntimeConfig().public.settingsVersion });
	writeJSONToLocalStorage<ClientSettings>("settings", settings);
	return settings;
}

export const useSettings = () =>
	useState<ClientSettings>("settings", () => {
		const storedSettings = readJSONFromLocalStorage<ClientSettings>("settings") ?? createSettings();
		const newestVersion = useRuntimeConfig().public.settingsVersion;
		const currentVersion = storedSettings.version;
		const migratedSettings = migrateSettings(currentVersion, newestVersion, storedSettings);
		if (newestVersion !== currentVersion) writeJSONToLocalStorage<ClientSettings>("settings", migratedSettings);
		return migratedSettings;
	});
