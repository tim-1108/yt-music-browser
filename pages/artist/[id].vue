<template>
	<div v-if="data" class="wrapper relative min-h-full grid gap-4">
		<div
			class="background absolute opacity-0 h-full w-full select-none pointer-events-none z-0 overflow-clip left-0 top-0"
			ref="background"
			v-if="data && data.artist_thumbnails.length">
			<ClientOnly>
				<NuxtImg
					class="h-full w-full blur-[100px] opacity-30 fixed"
					:src="data.artist_thumbnails[0]?.url"
					@load="fadeInBackground"
					:style="{ transform: `rotate(${generateRotation()}deg)` }"></NuxtImg>
			</ClientOnly>
		</div>
		<header
			class="relative rounded-xl overflow-hidden p-4 bg-no-repeat bg-cover bg-center"
			:style="{ backgroundImage: generateHeaderBackground(data.artist_thumbnails) }">
			<h1 class="relative drop-shadow">{{ data.name ?? "No name set" }}</h1>
			<section
				v-if="data.description"
				id="description"
				class="relative p-2 rounded-xl bg-[#232323] bg-opacity-75 backdrop-blur-md flex justify-between overflow-hidden transition-all"
				:class="{ open: isDescriptionOpen }">
				<PrettyWrap>{{ data.description }}</PrettyWrap>
				<ButtonTransparent
					@click="isDescriptionOpen = !isDescriptionOpen"
					class="aspect-square"
					:icon="['fas', isDescriptionOpen ? 'chevron-up' : 'chevron-down']"></ButtonTransparent>
			</section>
		</header>
		<section class="relative grid gap-4">
			<div class="flex justify-between gap-2 flex-wrap items-center">
				<h1>Popular songs</h1>
				<ButtonTransparent
					@click="navigateTo(generatePlaylistLink(data.popular_songs.playlist_id))"
					v-if="data.popular_songs.playlist_id"
					:icon="['fas', 'long-arrow-right']"
					position="after"
					>Show more</ButtonTransparent
				>
			</div>
			<SongPreviewRenderer v-for="song of data.popular_songs.list" :song="song" :show-cover="true"></SongPreviewRenderer>
			<p v-if="!data.popular_songs.list">No popular songs</p>
		</section>
		<section class="relative grid gap-4">
			<h1>Releases</h1>
			<Select class="!justify-start" :options="selectOptions" @update="(value) => (albumFilter = value as AlbumFilter)"></Select>
			<div class="grid gap-4 grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6" v-if="albums.length">
				<AlbumRenderer v-for="album of albums" :album="album"></AlbumRenderer>
			</div>
			<h2 class="text-center relative" v-else>No albums found for filter</h2>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { SizedThumbnail } from "~/server/types";

const route = useRoute();
// As we only have one [id].vue file, this should always be a string
const id = route.params.id as string;
const background = ref<Nullable<HTMLElement>>(null);

function generateHeaderBackground(thumbnails: SizedThumbnail[]) {
	return `url(${findThumbnailForResolution(thumbnails, THUMBNAIL_RESOLUTIONS.medium)?.url})`;
}

const selectOptions = [
	{ text: "All", value: "all", default: true },
	{ text: "Albums", value: "albums" },
	{ text: "Singles", value: "singles" }
];

type AlbumFilter = "all" | "albums" | "singles";
const albumFilter = ref<AlbumFilter>("all");

const isDescriptionOpen = ref(false);

const albums = computed(() => {
	if (!data.value?.albums) return [];
	switch (albumFilter.value) {
		case "all":
			return data.value.albums;
		case "albums":
			return data.value.albums.filter(({ album_type }) => /^Album|EP$/.test(album_type ?? ""));
		case "singles":
			return data.value.albums.filter(({ album_type }) => /^Single$/.test(album_type ?? ""));
	}
});

function fadeInBackground() {
	if (!background.value) return;
	background.value.animate({ opacity: "1" }, { duration: 500, easing: "ease-in-out", fill: "forwards" });
}

function generateRotation() {
	return Math.floor(Math.random() * 30);
}
const { data } = await useFetch("/api/artist", {
	query: { id }
});
</script>

<style scoped>
.wrapper {
	grid-template-rows: repeat(3, min-content);
}
.background {
	clip-path: var(--main-content-background-image-clip-path);
}
#description {
	--height: 85px;
}
#description:not(.open) {
	max-height: var(--height);
}
</style>
