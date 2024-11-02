<template>
	<NuxtLink :to="link">
		<slot />
	</NuxtLink>
</template>

<script setup lang="ts">
defineProps<{ link: string }>();
</script>

<style scoped>
a:hover {
	@apply underline;
}
</style>
