<template>
	<div class="grid gap-4">
		<p>These settings can be changed at any time, however only apply to downloads not yet started or still in the queue.</p>
		<section class="border-t-2 border-transparent flex flex-col pt-4 gap-2" v-for="metadata of settingsMetadata">
			<h2 v-if="metadata.title">{{ metadata.title }}</h2>
			<p v-if="metadata.description" v-html="metadata.description"></p>
			<Select
				v-if="metadata.type === 'select' && metadata.options"
				:options="metadata.options"
				@update="(value) => updateSettings(metadata.key, value)"></Select>
			<MultiSelect
				v-if="metadata.type === 'multi-select' && metadata.options"
				:options="metadata.options"
				@update="(value) => updateSettings(metadata.key, value)"></MultiSelect>
			<Toggle
				v-if="metadata.type === 'boolean'"
				:enabled="metadata.setting_toggle"
				@update="(value) => updateSettings(metadata.key, value)"></Toggle>
		</section>
		<section class="grid gap-2">
			<p>Sometimes, downloaders will disconnect after some time of inactivity. Revive them by clicking this button.</p>
			<ButtonBig :disabled="!isConnected" @click="pingDownloaders">Ping Downloaders</ButtonBig>
		</section>
		<form class="grid gap-2" @submit.prevent="requestDownloadersRestart(password)">
			<p>
				Force restarts all connected downloaders. All currently running downloads will be cancelled. This should only be used if an error
				occurred or a new commit is to be deployed.
			</p>
			<div class="grid grid-cols-all-auto w-full justify-between gap-2">
				<input :disabled="!isConnected" type="password" placeholder="Service Restart Password" required v-model="password" />
				<ButtonDefault :disabled="!isConnected" type="submit">Submit</ButtonDefault>
			</div>
		</form>
	</div>
</template>

<script setup lang="ts">
import type { AudioBitrate, ClientSettings, SponsorblockSegment } from "~/common/types";

const settings = useSettings();
const status = useSocketState();
const isConnected = computed(() => status.value === WebSocket.OPEN);
const password = ref("");

interface AudioBitrateSetting extends SettingsMetadata {
	options: { value: AudioBitrate; text: string; default?: boolean }[];
}

interface SponsorblockSegmentsSetting extends SettingsMetadata {
	options: { value: SponsorblockSegment; text: string; enabled?: boolean }[];
}

/**
 * Though the socket allows any values from 0 to 320, for the user it is far easier to select one of these options
 */
const audioBitrateOptions = [
	{ value: 0, text: "Auto" },
	{ value: 64, text: "Very Low (64kbps)" },
	{ value: 128, text: "Low (128kbps)" },
	{ value: 192, text: "Medium (192kbps)" },
	{ value: 256, text: "High (256kbps)" }
];
const audioBitrate: AudioBitrateSetting = {
	key: "audioBitrate",
	title: "Audio Bitrate",
	description: "Set to Auto for the maximum available quality. Some videos might not support all the highest qualities.",
	type: "select",
	options: audioBitrateOptions.map(({ value, text }) => ({ value, text, default: settings.value.audioBitrate === value }))
};

const sponsorblockOptions: { value: SponsorblockSegment; text: string }[] = [
	{ value: "music_offtopic", text: "Non-Music" },
	{ value: "sponsor", text: "Sponsor" },
	{ value: "intro", text: "Intro" },
	{ value: "outro", text: "Outro" },
	{ value: "selfpromo", text: "Self-Promo" },
	{ value: "preview", text: "Preview" },
	{ value: "filler", text: "Filler" },
	{ value: "interaction", text: "Interaction" }
];

const sponsorblockSegmentsSetting: SponsorblockSegmentsSetting = {
	key: "sponsorblockSegments",
	title: "Segments to remove",
	type: "multi-select",
	options: sponsorblockOptions.map((option) => ({ ...option, enabled: settings.value.sponsorblockSegments.includes(option.value) }))
};

interface SettingsMetadata {
	key: keyof ClientSettings;
	title?: string;
	description?: string;
	hidden?: boolean;
	disabled?: boolean;
	type: "none" | "boolean" | "select" | "multi-select";
	setting_toggle?: boolean;
	options?: { value: any; text: string; default?: boolean }[];
}

function updateSettings(key: keyof ClientSettings, value: any) {
	// @ts-ignore
	settings.value[key] = value;
	writeJSONToLocalStorage("settings", settings.value);
	submitClientSettings();
}

const settingsMetadata: SettingsMetadata[] = [
	audioBitrate,
	{ key: "useSponsorblock", title: "Use SponsorBlock", type: "boolean", setting_toggle: settings.value.useSponsorblock },
	sponsorblockSegmentsSetting,
	{
		key: "useMaxResCovers",
		title: "Use High-Resolution album covers",
		description: "Always try to load the highest quality covers available.",
		type: "boolean",
		setting_toggle: settings.value.useMaxResCovers
	},
	{
		key: "useAlbumSubfolders",
		title: "Create subfolders for albums",
		description: `
        If enabled, folders will be formatted as:
            <b>artist/album/song.mp3</b><br>
        Otherwise:
            <b>artist - album/song.mp3</b>
        <br>This setting exists for compatability reasons with media players which do not support subfolder navigation.
    `,
		type: "boolean",
		setting_toggle: settings.value.useAlbumSubfolders
	},
	{ key: "autoPackageOnFinish", title: "Auto-Package on Finish", type: "boolean", setting_toggle: settings.value.autoPackageOnFinish },
	{
		key: "shouldAttemptSessionRecovery",
		title: "Session Recovery",
		type: "boolean",
		setting_toggle: settings.value.shouldAttemptSessionRecovery,
		description:
			"If the client is disconnected, automatically attempt to reconnect it to the downloader. For a small window of time, all data on the server is preserved and will be restored."
	},
	{
		key: "saveLyrics",
		title: "Store Lyrics in Audio files",
		type: "boolean",
		setting_toggle: settings.value.saveLyrics,
		description: "The (unsynced) lyrics of the video, if available, will be stored. Media players might be able to display them."
	},
	{ key: "version", hidden: true, type: "none" }
];
</script>

<style scoped>
section:not(:last-child) {
	border-color: var(--light-border);
}
</style>
