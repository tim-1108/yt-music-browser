<template>
	<nav class="rounded-lg min-h-0 p-2 flex justify-evenly items-center">
		<ButtonTransparent
			:class="{ 'aspect-square': shouldUseMinimalLayout, selected: sidebarSelection === button.id }"
			v-for="button of usableButtons"
			:icon="['fas', button.icon]"
			class="hover:active:scale-95 transition-transform h-6 border-2 border-transparent relative"
			@click="sidebarSelection = button.id">
			<span v-if="!shouldUseMinimalLayout">{{ button.text }}</span>
			<Widget class="absolute -right-2 -top-1" v-if="button.id === 'downloads' && downloadCount">{{ downloadCount }}</Widget>
		</ButtonTransparent>
		<ConnectionInfo></ConnectionInfo>
	</nav>
</template>

<script setup lang="ts">
const buttons: { id: SidebarOption; icon: string; text: string; hidden?: boolean }[] = [
	{ id: "main", icon: "list", text: "", hidden: true },
	{ id: "search", icon: "search", text: "Search" },
	{ id: "downloads", icon: "long-arrow-down", text: "Downloads" },
	{ id: "settings", icon: "gear", text: "Settings" }
];

const queue = useDownloadQueue();
const current = useCurrentDownloads();

const downloadCount = computed(() => {
	const count = queue.value.size + current.value.size;
	if (count > 99) return "99+";
	return count;
});

const usableButtons = computed(() => {
	if (shouldUseMinimalLayout.value) return buttons;
	return buttons.filter((button) => !button.hidden);
});
const sidebarSelection = useSidebarSelection();
const shouldUseMinimalLayout = useMinimalLayoutToggle();

onMounted(() => {
	resizeListener();
	window.addEventListener("resize", resizeListener);
});

onBeforeUnmount(() => {
	window.removeEventListener("resize", resizeListener);
});

/**
 * The amount of pixels below which the hidden elements become visible
 */
const MAX_WIDTH_FOR_HIDDEN_TO_SHOW = 767;

function resizeListener() {
	const flag = window.innerWidth <= MAX_WIDTH_FOR_HIDDEN_TO_SHOW;
	shouldUseMinimalLayout.value = flag;
	if (!flag && sidebarSelection.value === "main") sidebarSelection.value = "search";
}
</script>

<style scoped>
nav {
	background-color: var(--section-background);
}
button.selected {
	@apply bg-white border-white;
}
</style>
