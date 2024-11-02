<template>
	<dialog class="p-4 rounded-lg place-self-center max-h-[70vh] overflow-scroll grid gap-2 bg-white text-black" ref="dialog">
		<header class="flex justify-between items-center">
			<h2>Editing metadata for {{ list.size }} video(s)</h2>
			<ButtonTransparent class="text-xl aspect-square" @click="closeDialog" :icon="['fas', 'xmark']"></ButtonTransparent>
		</header>
		<div class="flex gap-2 flex-wrap">
			<Toggle :enabled="shouldCreateArtistFolder" @update="(value) => (shouldCreateArtistFolder = value)">Create Artist folder</Toggle>
			<Toggle :enabled="shouldCreateAlbumFolder" @update="(value) => (shouldCreateAlbumFolder = value)">Create Album folder</Toggle>
			<ButtonDefault @click="applyTrackNumbers" :icon="['fas', 'clone']">Apply Track numbers by current order</ButtonDefault>
		</div>
		<section v-for="[id, item] of list" class="rounded-md text-white p-2 w-full md:w-[50vw] relative overflow-clip shadow-md">
			<BlurredBackground
				v-if="item.metadata.cover"
				class="left-0 w-full min-h-full"
				blur="20px"
				:image="item.metadata.cover"
				:use-offset="true"></BlurredBackground>
			<div class="relative flex gap-2 justify-between items-center" v-if="selectedVideoId !== id">
				<div class="flex gap-2 items-center">
					<span>{{ item.metadata.track }}</span>
					<Thumbnail class="rounded-md h-8 min-w-fit" :image="item.metadata.cover"></Thumbnail>
					<h3>{{ item.metadata.title }}</h3>
				</div>
				<div class="flex gap-2">
					<ButtonDefault @click="list.delete(id)" :icon="['fas', 'trash-can']">Delete</ButtonDefault>
					<ButtonDefault @click="selectedVideoId = id" :icon="['fas', 'pen-to-square']">Edit</ButtonDefault>
				</div>
			</div>
			<div class="editing-wrapper grid gap-2 relative" v-else>
				<div class="grid gap-2 whitespace-nowrap h-fit">
					<Thumbnail class="rounded-md place-content-center" :image="item.metadata.cover"></Thumbnail>
					<ButtonDefault
						:icon="['fas', 'clone']"
						v-if="item.metadata.cover"
						@click="cloneMetadataProperty<string>('cover', item.metadata.cover)"
						>Clone to whole list</ButtonDefault
					>
					<ButtonDefault :icon="['fas', 'image']" @click="selectNewCover(id)">Choose another</ButtonDefault>
					<ButtonDefault :icon="['fas', 'trash-can']" v-if="item.metadata.cover" @click="item.metadata.cover = undefined"
						>Delete Cover</ButtonDefault
					>
				</div>
				<div class="grid gap-2 h-fit">
					<h4>Song / Video name</h4>
					<input placeholder="Song / Video name" v-model="item.metadata.title" />
					<div class="flex justify-between flex-wrap gap-2 items-center">
						<h4>Album name</h4>
						<ButtonDefault :icon="['fas', 'clone']" @click="cloneProperty<IdentifiedString>('album', item.album)"
							>Clone to whole list</ButtonDefault
						>
					</div>
					<input placeholder="Album name" v-model="item.album.name" />
					<div class="flex justify-between flex-wrap gap-2 items-center">
						<h4>Artists</h4>
						<ButtonDefault :icon="['fas', 'clone']" @click="cloneProperty<IdentifiedString[]>('artists', item.artists)"
							>Clone to whole list</ButtonDefault
						>
					</div>
					<TextList :start-values="item.artists.map(({ name }) => name)" @add="addArtist" @remove="removeArtist"></TextList>
				</div>
				<div class="grid gap-2 h-fit">
					<input class="text-center" placeholder="Track Number" type="number" v-model="item.metadata.track" min="1" max="999" />
					<ButtonDefault :icon="['fas', 'trash-can']" @click="list.delete(id)">Delete Item</ButtonDefault>
				</div>
			</div>
		</section>
		<p v-if="!list.size">Nothing to edit</p>
		<div class="sticky flex justify-end bottom-2 mt-2">
			<ButtonDefault class="green !opacity-100" @click="downloadAll" :disabled="downloaderState !== 1" :icon="['fas', 'long-arrow-down']">{{
				downloaderState === 1 ? "Download All" : "Not connected"
			}}</ButtonDefault>
		</div>
	</dialog>
</template>

<script setup lang="ts">
import type { ExtendedVideoInfo, IdentifiedString, VideoID, VideoMetadata } from "~/common/types";

function applyTrackNumbers() {
	let index = 0;
	for (const [id, item] of list.value) {
		item.metadata.track = ++index;
	}
}

const shouldCreateArtistFolder = ref(true);
const shouldCreateAlbumFolder = ref(true);

const thumbnailChooser = useThumbnailChooser();
const list = useMetadataEdits();
const editState = useEditState();
const selectedVideoId = ref(toRaw(thumbnailChooser.value));
const item = computed(() => (selectedVideoId.value === null ? null : list.value.get(selectedVideoId.value)));
const downloaderState = useSocketState();
const dialog = ref<Nullable<HTMLDialogElement>>(null);
onMounted(() => {
	thumbnailChooser.value = null;
	dialog.value?.showModal();
	if (dialog.value === null) return;
	dialog.value.addEventListener(
		"close",
		() => {
			editState.value = false;
		},
		{ once: true }
	);
});
function addArtist(artist: string) {
	if (!item.value) return;
	item.value.artists.push({ id: "", name: artist });
}
function removeArtist(artist: string) {
	if (!item.value) return;
	const index = item.value.artists.findIndex((item) => item.name === artist);
	if (index === -1) return;
	item.value.artists.splice(index, 1);
}
function cloneProperty<T>(key: keyof ExtendedVideoInfo, value: T) {
	for (const [id, item] of list.value) {
		(item[key] as T) = structuredClone(toRaw(value));
	}
}
function cloneMetadataProperty<T>(key: keyof VideoMetadata, value: T) {
	for (const [id, item] of list.value) {
		(item.metadata[key] as T) = structuredClone(toRaw(value));
	}
}
function closeDialog() {
	thumbnailChooser.value = null;
	dialog.value?.close();
	editState.value = false;
}

function selectNewCover(id: VideoID) {
	thumbnailChooser.value = id;
	dialog.value?.close();
	editState.value = false;
}
async function downloadAll() {
	for (const [id, item] of list.value) {
		// The metadata editor does not write to the metadata of artists and album when editing
		// (to preserve the identified strings)
		// Only when it is finished here, it writes them there so the downloader knows
		item.metadata.artists = item.artists.map(({ name }) => name);
		item.metadata.album = item.album.name;
		// If the input is empty, it is set to an empty string, the server won't accept that, so we set it to undefined
		if (typeof item.metadata.track === "string") item.metadata.track = undefined;
		addDownload(item.metadata, item.artists, item.album, item.length, shouldCreateArtistFolder.value, shouldCreateAlbumFolder.value);
		await sleep(50);
	}
	closeDialog();
	clearMetadataEditor();
}
</script>

<style scoped>
@media (min-width: 768px) {
	.editing-wrapper {
		grid-template:
			"a b"
			"a b"
			"c b";
		grid-template-columns: min-content 1fr;
	}
	.editing-wrapper > *:nth-child(1) {
		grid-area: a;
	}
	.editing-wrapper > *:nth-child(2) {
		grid-area: b;
	}
	.editing-wrapper > *:nth-child(3) {
		grid-area: c;
	}
}
input,
button {
	@apply shadow-md;
}
section {
	background: var(--button-background);
}
</style>
