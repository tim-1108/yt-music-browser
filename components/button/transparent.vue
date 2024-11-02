<template>
	<button class="rounded-3xl py-1 px-3 transition-colors flex items-center gap-2 h-fit hover:bg-white !bg-opacity-25">
		<Icon v-if="icon && (!position || position === 'before')" :icon="icon"></Icon>
		<slot />
		<Icon v-if="icon && position === 'after'" :icon="icon"></Icon>
	</button>
</template>

<script setup lang="ts">
defineProps<{ icon?: string[]; position?: "before" | "after" }>();
</script>

<style scoped>
button[disabled] {
	@apply cursor-not-allowed opacity-50;
}
</style>
