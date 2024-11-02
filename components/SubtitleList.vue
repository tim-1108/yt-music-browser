<template>
	<div class="wrapper flex gap-x-2 flex-wrap">
		<slot />
	</div>
</template>

<style scoped>
.wrapper > *:not(:last-child)::after {
	@apply ml-1;
	content: var(--filler-content);
}
</style>
