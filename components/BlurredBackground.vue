<template>
	<div
		class="wrapper absolute h-full top-0 select-none pointer-events-none"
		:class="{ 'opacity-0': !noFade, 'opacity-100': noFade }"
		ref="container">
		<ClientOnly>
			<NuxtImg
				:src="image"
				@load="fadeIn"
				class="w-[inherit] opacity-30"
				:style="{
					filter: `blur(${blur})`,
					transform: useOffset ? `translateY(${generateYOffset()}px)` : ''
				}"></NuxtImg>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
defineProps<{ image: string; blur?: string; useOffset?: boolean; noFade?: boolean }>();
const container = ref<Nullable<HTMLElement>>(null);

function fadeIn() {
	container.value?.animate({ opacity: "1" }, { duration: 500, easing: "ease-in-out", fill: "forwards" });
}

function generateYOffset() {
	return -Math.floor(Math.random() * ((container.value?.clientWidth ?? 1) / 2));
}
</script>

<style scoped>
.wrapper {
	overflow: clip;
}
</style>
