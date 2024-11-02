<template>
	<div class="grid md:flex justify-between flex-wrap gap-2">
		<div class="flex gap-2 items-center">
			<span class="w-10 text-center" v-if="index !== undefined">{{ index + 1 }}</span>
			<Thumbnail
				v-if="showCover && song.thumbnails"
				class="w-10 rounded-md"
				:image="findThumbnailForResolution(song.thumbnails, THUMBNAIL_RESOLUTIONS.small)?.url"></Thumbnail>
			<div class="grid">
				<span class="font-bold">{{ song.name }}</span>
				<SubtitleList>
					<span v-if="song.views">{{ song.views }}</span>
					<span v-if="showArtists" v-for="artist of song.artists">
						<NuxtLink :to="generateArtistLink(artist.id as string)">
							{{ artist.name }}
						</NuxtLink>
					</span>
					<span v-if="song.album">
						<NuxtLink :to="generatePlaylistLink(song.album.id)">{{ song.album.name }}</NuxtLink>
					</span>
					<span v-for="creator of song.creators">
						{{ creator }}
					</span>
				</SubtitleList>
			</div>
		</div>
		<div class="flex gap-2 items-center">
			<ButtonDownload
				:metadata="metadataFromPlaylistItem(song, typeof index === 'number' && !showArtists ? index + 1 : undefined, playlist)"
				:artists="showArtists ? props.song.artists : (playlist?.artists ?? props.song.artists)"
				:album="showArtists ? props.song.album : (playlist?.album ?? props.song.album)"
				:length="props.song.length"
				:album-cover="albumCover"></ButtonDownload>
			<span>{{ song.length }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { PlaylistItem } from "~/common/types";

// If showArtists is enabled, this is not a album. Thus, we do not want to
// embed the data from the playlist, nor the track number from the playlist
const props = defineProps<{ song: PlaylistItem; playlist?: PlaylistData; showCover?: boolean; showArtists?: boolean; index?: number }>();
// The cover of the album/playlist is used when the cover for the item is undefined
// (in albums or mixes of different albums that count as albums but aren't, yeah...)
const albumCover = computed(() =>
	props.song.thumbnails?.length ? undefined : findThumbnailForResolution(props.playlist?.thumbnails, THUMBNAIL_RESOLUTIONS.medium)?.url
);
</script>
