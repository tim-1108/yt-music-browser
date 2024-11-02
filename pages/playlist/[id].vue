<template>
	<div class="relative h-full w-full" ref="container">
		<h1 v-if="data && !data.items.length">This playlist cannot be loaded</h1>
		<div class="relative z-[3] min-h-full" v-else-if="data && data.items.length">
			<div
				class="background absolute opacity-0 top-0 h-full w-full select-none pointer-events-none z-[-1]"
				ref="background"
				v-if="data && data.thumbnails.length">
				<ClientOnly>
					<NuxtImg
						class="h-full w-full blur-[100px] opacity-30 fixed"
						:src="data.thumbnails[0]?.url"
						@load="fadeInBackground"
						:style="{ transform: `rotate(${generateRotation()}deg)` }"></NuxtImg>
				</ClientOnly>
			</div>
			<header class="lg:flex lg:justify-between w-full grid grid-cols-1 gap-2">
				<div class="grid lg:flex gap-4 w-full">
					<Thumbnail
						class="h-28 rounded-xl min-w-fit justify-center lg:justify-start"
						:image="findThumbnailForResolution(data.thumbnails, THUMBNAIL_RESOLUTIONS.medium)?.url"></Thumbnail>
					<div class="grid gap-2 place-content-center lg:place-content-start w-full">
						<h1 class="text-center lg:text-start">
							<PrettyWrap>{{ data.title }}</PrettyWrap>
						</h1>
						<div class="flex items-center gap-2 w-full flex-wrap justify-center lg:justify-start">
							<NuxtImg v-if="data.artist_thumbnails?.length" class="rounded-full h-6" :src="data.artist_thumbnails[0]?.url"></NuxtImg>
							<SubtitleList>
								<div v-for="artist of data.artists">
									<NuxtLink :to="generateArtistLink(artist.id as string)">{{ artist.name }}</NuxtLink>
								</div>
								<span v-if="!data.artists.length">No artists</span>
							</SubtitleList>
						</div>
					</div>
				</div>
				<div class="flex lg:grid gap-1 place-self-center lg:place-self-end flex-wrap">
					<ButtonTransparent
						@click="downloadAll"
						class="whitespace-nowrap"
						:disabled="!isDownloaderConnected"
						:icon="['fas', 'long-arrow-down']"
						>Download All</ButtonTransparent
					>
					<ButtonTransparent @click="editAll" class="w-fit whitespace-nowrap justify-self-end" :icon="['fas', 'plus']"
						>Edit All</ButtonTransparent
					>
				</div>
			</header>
			<div class="grid gap-4 py-2">
				<SongPreviewRenderer
					v-for="(item, index) of data.items"
					:song="item"
					:playlist="list"
					:show-artists="!isAlbumPage"
					:show-cover="!isAlbumPage"
					:index="index"></SongPreviewRenderer>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { IdentifiedString } from "~/server/types";

const route = useRoute();
// As we only have one [id].vue file, this should always be a string
const id = route.params.id as string;
const background = ref<Nullable<HTMLElement>>(null);

const status = useSocketState();
const isDownloaderConnected = computed(() => status.value === WebSocket.OPEN);

function fadeInBackground() {
	if (!background.value) return;
	background.value.animate({ opacity: "1" }, { duration: 500, easing: "ease-in-out", fill: "forwards" });
}

function generateRotation() {
	return Math.floor(Math.random() * 30);
}

function editAll() {
	if (!data.value) return;
	const isInsidePlaylist = data.value.type === "Playlist" || !data.value.artists.length;
	const artistsFromPlaylist = isAlbumPage.value ? data.value.artists : undefined;
	const items: ExtendedVideoInfo[] = data.value.items.map(({ id, name, artists, album, thumbnails, length }, index) => ({
		metadata: {
			video_id: id,
			title: name,
			track: isAlbumPage.value ? index + 1 : undefined,
			// These will get set later when the video is supposed to be downloaded
			// The metadata editor only works with the identified strings
			artists: [],
			cover: findThumbnailForResolution(
				isInsidePlaylist && thumbnails?.length ? thumbnails : (data.value?.thumbnails ?? thumbnails),
				THUMBNAIL_RESOLUTIONS.medium
			)?.url
		},
		artists: artistsFromPlaylist ?? artists ?? [],
		album: albumNameForItem(album),
		length
	}));
	addToMetadataEditor(items, true);
}

function albumNameForItem(itemAlbum: IdentifiedString = rawToIdentifiedString("")) {
	return data.value?.type !== "Playlist" ? (rawToIdentifiedString(data.value?.title) ?? itemAlbum) : itemAlbum;
}

async function downloadAll() {
	if (data.value === null) return;
	let index = 0;
	for (const item of data.value.items) {
		// The ++ is placed at front by design (due to the track starting at 1)
		addDownload(
			metadataFromPlaylistItem(item, ++index, list.value),
			isAlbumPage.value ? list.value.artists : (item.artists ?? list.value.artists),
			albumNameForItem(item.album),
			item.length
		);
		// If we spam these, the service might reject them (or some)
		await sleep(50);
	}
}
const list = computed((): PlaylistData => {
	if (!data.value) return { thumbnails: [] };
	return {
		thumbnails: data.value.thumbnails,
		artists: data.value.artists,
		album_type: data.value.type,
		album: { name: data.value.title ?? "", id }
	};
});

const isAlbumPage = computed(() => {
	if (!data.value) return false;
	return data.value.artists.length > 0 && data.value.type !== "Playlist";
});

const { data } = await useFetch("/api/playlist", {
	query: { id }
});
</script>

<style scoped>
.background {
	clip-path: var(--main-content-background-image-clip-path);
}
header > div {
	grid-template-columns: 1fr;
}
</style>
