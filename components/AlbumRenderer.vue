<template>
	<NuxtLink
		:to="generatePlaylistLink(album.id)"
		class="flex flex-row flex-wrap cursor-pointer hover:active:scale-95 transition-transform min-w-0 select-none h-fit !no-underline">
		<Thumbnail class="rounded-xl w-full" :image="findThumbnailForResolution(album.thumbnails, THUMBNAIL_RESOLUTIONS.medium)?.url"></Thumbnail>
		<h3 class="inline whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-full">{{ album.title ?? "No name" }}</h3>
		<SubtitleList class="text-sm text-gray-300">
			<span>{{ album.album_type ?? "Unknown" }}</span>
			<span>{{ album.release ?? "Unknown release" }}</span>
		</SubtitleList>
	</NuxtLink>
</template>

<script setup lang="ts">
import type { Album } from "~/server/types";

defineProps<{ album: Album }>();
</script>
