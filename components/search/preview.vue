<template>
	<div class="relative w-full rounded-md overflow-clip" ref="container" :class="{ clickable: isClickable }" @click="navigateToDetails">
		<div class="background absolute h-full w-full z-[0] rounded-md">
			<NuxtImg
				class="w-full h-fit opacity-30 blur-2xl relative pointer-events-none select-none"
				:src="thumbnail"
				:style="{ transform: `rotate(${generateRotation()}deg)`, top: generateYOffset() + 'px' }"></NuxtImg>
		</div>
		<div class="flex justify-between relative w-full items-center p-2">
			<div class="flex h-full gap-2 items-center">
				<Thumbnail
					class="w-20 min-w-20"
					:class="{ 'rounded-full': result.type === 'artist', 'rounded-md': result.type !== 'artist' }"
					:image="thumbnail"></Thumbnail>
				<div class="grid gap-1">
					<h2 class="break-all">
						{{ result.name }}
					</h2>
					<SubtitleList v-if="result.type === 'song'">
						<span v-for="artist of result.artists">
							<NuxtLink :to="generateArtistLink(artist.id)" @click="switchToMain">{{ artist.name }}</NuxtLink>
						</span>
						<span v-if="result.album">
							<NuxtLink :to="generatePlaylistLink(result.album.id)" @click="switchToMain">{{ result.album.name }}</NuxtLink>
						</span>
						<span v-if="result.length">{{ result.length }}</span>
					</SubtitleList>
					<SubtitleList v-else-if="result.type === 'album'">
						<span v-if="result.album_type">{{ result.album_type }}</span>
						<span v-for="artist of result.artists">
							<NuxtLink :to="generateArtistLink(artist.id)" @click="switchToMain">{{ artist.name }}</NuxtLink>
						</span>
					</SubtitleList>
					<SubtitleList v-else-if="result.type === 'video'">
						<span v-for="artist of result.artists">
							<NuxtLink :to="generateArtistLink(artist.id)" @click="switchToMain">{{ artist.name }}</NuxtLink>
						</span>
						<span v-for="creator of result.creators">{{ creator }}</span>
						<span v-if="result.length">{{ result.length }}</span>
					</SubtitleList>
					<SubtitleList v-else-if="result.type === 'playlist'">
						<span v-if="result.creator">{{ result.creator }}</span>
					</SubtitleList>
				</div>
			</div>
			<ButtonDownload
				:compact="true"
				v-if="result.type === 'song' || result.type === 'video'"
				:metadata="buildMetadata(result)"
				:artists="computedArtists"
				:album="/* @ts-ignore only exists on song type */ result.album"
				:length="result.length"></ButtonDownload>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { VideoMetadata } from "~/common/types";
import type { SongSearchResult, VideoSearchResult } from "~/server/types";

const computedArtists = computed(() => {
	// Some normal videos may also have an artist and no creators set
	// (if the video was published by a artist => a music video)
	const result = props.result as VideoSearchResult;
	return result.artists.length ? result.artists : (result.creators?.map((creator) => ({ name: creator, id: "" })) ?? []);
});

const sidebarSelection = useSidebarSelection();
const shouldUseMinimalLayout = useMinimalLayoutToggle();
async function switchToMain() {
	if (!shouldUseMinimalLayout.value) return;
	await nextTick();
	sidebarSelection.value = "main";
}

const props = defineProps<{ result: YouFindThatDamnSearchResultType }>();
const container = ref<Nullable<HTMLElement>>(null);

const isClickable = computed(() => ["playlist", "album", "artist"].includes(props.result.type));

function buildMetadata(result: SongSearchResult | VideoSearchResult): VideoMetadata {
	const cover = findThumbnailForResolution(result.thumbnails, THUMBNAIL_RESOLUTIONS.medium)?.url;
	const isVideo = result.type === "video";
	// This is some hackery for the service to recognize these as "artists" and to add them to the file metadata
	return {
		video_id: result.id,
		title: result.name,
		album: isVideo ? undefined : result.album?.name,
		artists: isVideo ? result.creators : identifiedStringsToRaw(result.artists),
		cover
	};
}

function generateRotation() {
	return Math.floor(Math.random() * 30);
}

const thumbnail = computed(() => props.result.thumbnails.at(0)?.url ?? "");

function generateYOffset() {
	return -Math.floor(Math.random() * ((container.value?.clientWidth ?? 1) / 2));
}

function generateSubtitle(...texts: (string | undefined)[]) {
	return texts.filter((x) => x !== undefined).join(" • ");
}

function navigateToDetails() {
	switch (props.result.type) {
		case "album": {
			navigateTo(generatePlaylistLink(props.result.id));
			switchToMain();
			break;
		}
		case "playlist": {
			navigateTo(generatePlaylistLink(props.result.id));
			switchToMain();
			break;
		}
		case "artist": {
			navigateTo(generateArtistLink(props.result.id));
			switchToMain();
			break;
		}
	}
}
</script>

<style scoped>
.background {
	clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
}
.clickable {
	@apply transition-transform cursor-pointer;
}
.clickable:hover:active {
	@apply scale-95;
}
</style>
