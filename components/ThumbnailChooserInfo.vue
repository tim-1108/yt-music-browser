<template>
	<BottomInfoBox class="flex gap-2 items-center">
		<div class="grid text-center">
			<span>You are choosing a new cover</span>
			<small>Press on any other cover image to choose it</small>
		</div>
		<ButtonTransparent class="aspect-square" :icon="['fas', 'xmark']" @click="editState = true"></ButtonTransparent>
	</BottomInfoBox>
</template>

<script setup lang="ts">
const editState = useEditState();
</script>
