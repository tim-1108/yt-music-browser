<template>
	<div class="relative min-w-fit">
		<NuxtImg class="back-layer h-full w-full absolute z-[-1] blur-xl" :src="image"></NuxtImg>
		<NuxtImg class="h-full w-full min-w-fit" :src="image" :style="{ borderRadius: rounded }"></NuxtImg>
	</div>
</template>

<script setup lang="ts">
defineProps<{ image: string; rounded?: string }>();
</script>
