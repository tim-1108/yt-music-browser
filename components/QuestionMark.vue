<template>
	<div class="cursor-pointer" ref="wrapper">
		<Icon :icon="['fas', 'circle-question']" @mouseenter="showBox" @mouseleave="hideBox"></Icon>
		<div
			class="fixed bg-gray-500 bg-opacity-80 backdrop-blur-md p-2 rounded-md opacity-0 min-w-60 w-fit max-w-screen-sm z-40"
			ref="box"
			v-if="isBoxVisible">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
const wrapper = ref<Nullable<HTMLElement>>(null);
const box = ref<Nullable<HTMLElement>>(null);
const isBoxVisible = ref(false);
const MIN_MARGIN = 16;
/**
 * The offset from the top of the container (the questionmark) the info box should have.
 * This is basically the height of the icon + some margin
 */
const BOX_TOP_OFFSET = 30;
async function showBox() {
	if (wrapper.value === null) return;
	isBoxVisible.value = true;
	await nextTick();
	await sleep(50);
	if (box.value === null) return;
	const bounds = wrapper.value.getBoundingClientRect();
	box.value.style.left = clampNumber(bounds.left, MIN_MARGIN, window.innerWidth - box.value.clientWidth - MIN_MARGIN) + "px";
	box.value.style.top = clampNumber(bounds.top + BOX_TOP_OFFSET, MIN_MARGIN, window.innerHeight - box.value.clientHeight - MIN_MARGIN * 2) + "px";
	box.value.animate({ opacity: "1" }, { fill: "forwards", duration: 150 });
}
function hideBox() {
	if (box.value === null) return;
	box.value.animate({ opacity: "0" }, { fill: "forwards", duration: 150 });
	isBoxVisible.value = false;
}
</script>
