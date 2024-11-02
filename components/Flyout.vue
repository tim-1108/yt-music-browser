<template>
	<aside
		class="flyout w-[80vw] max-h-[80vh] overflow-y-scroll md:w-auto md:mx-0 md:max-w-92 md:w-92 min-w-0 fixed rounded-lg shadow-lg p-4 border-solid border-2 z-50"
		ref="flyout">
		<slot />
	</aside>
</template>

<script setup lang="ts">
const flyout = ref<HTMLElement | null>(null);
/**
 * For vertical alignment, bottom is the default behaviour.
 */
const props = defineProps<{ parent: HTMLElement; verticalAlignment?: "top" | "bottom" }>();
onMounted(async () => {
	findPosition();
	await sleep(100);
	window.addEventListener("resize", findPosition);
	document.addEventListener("click", listenForClosure);
});

const MARGIN_TO_SCREEN_BORDER = 16;

async function findPosition() {
	await nextTick();
	if (flyout.value === null) return console.error("Could not spawn flyout due to ref being null");
	const flyoutDimensions = flyout.value.getBoundingClientRect();
	const parent = props.parent.getBoundingClientRect();

	const requestedYPos = props.verticalAlignment === "top" ? parent.top - flyoutDimensions.height : parent.top + parent.height;

	const x = clampNumber(
		parent.left + parent.width / 2 - flyoutDimensions.width / 2,
		MARGIN_TO_SCREEN_BORDER,
		window.innerWidth - flyoutDimensions.width - MARGIN_TO_SCREEN_BORDER
	);
	const y = clampNumber(requestedYPos, MARGIN_TO_SCREEN_BORDER, window.innerHeight - flyoutDimensions.height - MARGIN_TO_SCREEN_BORDER);

	flyout.value.style.left = x + "px";
	flyout.value.style.top = y + "px";
}

function listenForClosure(event: MouseEvent) {
	if ((event.target as HTMLElement).closest("aside.flyout")) return;
	window.removeEventListener("resize", findPosition);
	document.removeEventListener("click", listenForClosure);
	emit("close");
}

const emit = defineEmits<{ close: [] }>();
defineExpose({ findPosition });
</script>

<style scoped>
aside {
	background-color: var(--section-background);
	border-color: var(--light-border);
}
</style>
