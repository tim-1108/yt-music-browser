<template>
	<section class="relative">
		<iframe
			v-if="id !== null"
			class="w-full min-h-40"
			:src="YOUTUBE_EMBED_BASE + id + PLAYER_PARAMS"
			title="YouTube video player"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
			referrerpolicy="strict-origin-when-cross-origin"
			allowfullscreen>
		</iframe>
		<div v-else>
			<h2>Select a video</h2>
			<p>A preview will be shown here</p>
		</div>
		<button
			class="absolute top-2 right-2 text-3xl h-10 w-10 rounded-full bg-red-500 text-white grid place-content-center shadow"
			@click="id = null">
			<Icon :icon="['fas', 'xmark']"></Icon>
		</button>
	</section>
</template>

<script setup lang="ts">
const YOUTUBE_EMBED_BASE = "https://www.youtube-nocookie.com/embed/";
const PLAYER_PARAMS = "?autoplay=1&controls=2&playsinline=1&rel=0";
const id = useEmbeddedVideo();
</script>
