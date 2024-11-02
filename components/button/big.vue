<template>
	<button
		class="p-2 rounded-full bg-white text-black flex gap-4 justify-center font-bold text-lg items-center text-balance px-4 hover:active:scale-95">
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
	@apply cursor-not-allowed;
}
</style>
