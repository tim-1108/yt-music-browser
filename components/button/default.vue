<template>
	<button class="rounded-xl text-white flex gap-2 h-fit items-center px-4 py-1 transition-all hover:active:scale-95 select-none">
		<Icon v-if="icon && (!position || position === 'before')" :icon="icon"></Icon>
		<slot />
		<Icon v-if="icon && position === 'after'" :icon="icon"></Icon>
	</button>
</template>

<script setup lang="ts">
defineProps<{ icon?: string[]; position?: "before" | "after" }>();
</script>

<style scoped>
button {
	background: var(--button-background);
}
button:hover {
	background: var(--button-hover-background);
}
button.green {
	@apply text-black;
	background: var(--button-green-background);
}
button.green:hover {
	background: var(--button-green-hover-background);
}
button[disabled] {
	@apply cursor-not-allowed opacity-50;
}
</style>
