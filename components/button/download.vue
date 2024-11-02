<template>
	<div class="flex items-center justify-center" :class="{ flex: !compact, grid: compact }" ref="buttonsRef">
		<span v-if="inQueue && inQueue.queue_position !== null">Enqueued ({{ inQueue.queue_position + 1 }})</span>
		<InfiniteSpinner v-else-if="isRunning" :size="15"></InfiniteSpinner>
		<Icon v-else-if="isFinished" :icon="['fas', 'check']"></Icon>

		<ButtonTransparent
			class="aspect-square"
			:class="{ hidden: (button.hidden_when_not_compact && !compact) || button.hidden?.value }"
			v-for="button of shownButtons"
			:disabled="button.disabled?.value"
			@click="button.click"
			:icon="button.icon"
			:aria-label="button.title"
			:title="button.title"></ButtonTransparent>

		<Flyout
			class="!max-w-fit !w-fit grid gap-2 !p-2"
			v-if="buttonsRef && isDropdownVisible"
			:parent="buttonsRef"
			@close="isDropdownVisible = false">
			<ButtonDefault
				v-for="button of flyoutButtons"
				:disabled="button.disabled?.value"
				:class="{ hidden: button.hidden }"
				@click="button.click"
				:icon="button.icon"
				:aria-label="button.title"
				:title="button.title"
				>{{ button.title }}</ButtonDefault
			>
		</Flyout>

		<Flyout class="!p-2 w-52 sm:w-96" ref="lyricsFlyout" v-if="buttonsRef && lyricsVisible" @close="lyricsVisible = false" :parent="buttonsRef">
			<InfiniteSpinner v-if="isLoadingLyrics" :size="30"></InfiniteSpinner>
			<div v-else-if="videoLyrics && videoLyrics.lyrics">
				<div class="flex justify-between items-center">
					<h1>Lyrics</h1>
					<ButtonTransparent class="aspect-square text-xl" @click="lyricsVisible = false" :icon="['fas', 'xmark']"></ButtonTransparent>
				</div>
				<p v-html="videoLyrics.lyrics.replace(/\n/g, '<br>')"></p>
				<footer v-if="videoLyrics.source" class="text-sm text-gray-300">Provided to YouTube by {{ videoLyrics.source }}</footer>
			</div>
			<p v-else>No lyrics available</p>
		</Flyout>
	</div>
</template>

<script setup lang="ts">
import type { VideoMetadata, IdentifiedString, ExtendedVideoInfo } from "~/common/types";
import Flyout from "../Flyout.vue";

const status = useSocketState();
const isDropdownVisible = ref(false);
const embeddedVideo = useEmbeddedVideo();
const isOpenInEmbed = computed(() => props.metadata.video_id === embeddedVideo.value);
const buttonsRef = ref<HTMLElement | null>(null);

const isDownloaderConnected = computed(() => status.value === WebSocket.OPEN);

const lyricsVisible = ref(false);
const isLoadingLyrics = ref(false);
const lyricsFlyout = ref<typeof Flyout | null>(null);
const lyricsList = useLyrics();
const videoLyrics = computed(() => lyricsList.value.get(props.metadata.video_id));

function play() {
	isDropdownVisible.value = false;
	embeddedVideo.value = props.metadata.video_id;
}

async function loadLyrics() {
	isDropdownVisible.value = false;
	lyricsVisible.value = true;
	isLoadingLyrics.value = true;
	await fetchVideoLyrics(props.metadata.video_id);
	isLoadingLyrics.value = false;
	await nextTick();
	if (lyricsFlyout.value) lyricsFlyout.value.findPosition();
}

const props = defineProps<{
	metadata: VideoMetadata;
	compact?: boolean;
	artists: IdentifiedString[];
	album?: IdentifiedString;
	length?: string;
	albumCover?: string;
}>();

function replaceCoverInMetadata() {
	return {
		...props.metadata,
		cover: props.metadata.cover ?? props.albumCover
	};
}

function createEditorMetadata() {
	isDropdownVisible.value = false;
	const metadata = replaceCoverInMetadata();
	const item: ExtendedVideoInfo = {
		metadata,
		artists: props.artists,
		album: props.album ?? { id: "", name: "" },
		length: props.length
	};
	addToMetadataEditor([item]);
}

const queue = useDownloadQueue();
const finished = useFinishedDownloads();
const current = useCurrentDownloads();

const metadataEdits = useMetadataEdits();
const isInMetadataEditor = computed(() => metadataEdits.value.has(props.metadata.video_id));

const inQueue = computed(() => queue.value.get(props.metadata.video_id));
const isFinished = computed(() => finished.value.has(props.metadata.video_id));
const isRunning = computed(() => current.value.has(props.metadata.video_id));

const buttons = [
	{
		icon: ["fas", "long-arrow-down"],
		title: "Download",
		visible_when_compact: true,
		disabled: computed(() => !isDownloaderConnected.value),
		hidden: computed(() => inQueue.value || isFinished.value || isRunning.value),
		click: () => addDownload(replaceCoverInMetadata(), props.artists, props.album, props.length)
	},
	{ icon: ["fas", "plus"], title: "Edit", click: createEditorMetadata, disabled: isInMetadataEditor },
	{ icon: ["fas", "play"], title: "Play in embed", click: play, disabled: isOpenInEmbed },
	{ icon: ["far", "closed-captioning"], title: "Show lyrics", click: loadLyrics },
	{
		icon: ["fas", "ellipsis"],
		title: "Show more",
		visible_when_compact: true,
		hidden_when_not_compact: true,
		click: () => (isDropdownVisible.value = true)
	}
];
const flyoutButtons = computed(() => {
	if (!props.compact) return [];
	return buttons.filter((button) => !button.visible_when_compact);
});
const shownButtons = computed(() => {
	if (!props.compact) return buttons;
	return buttons.filter((button) => button.visible_when_compact);
});
</script>

<style scoped>
button {
	@apply whitespace-nowrap;
}
</style>
