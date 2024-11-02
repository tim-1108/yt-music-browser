<template>
	<BottomInfoBox class="grid justify-center">
		<span>You have {{ metadataEdits.size }} video(s) in the editor</span>
		<div class="flex gap-2 justify-center">
			<ButtonTransparent :icon="['fas', 'arrow-up-right-from-square']" @click="metadataEditorState = true">View</ButtonTransparent>
			<ButtonTransparent :icon="['fas', 'xmark']" @click="clearMetadataEditor">Dismiss</ButtonTransparent>
		</div>
	</BottomInfoBox>
</template>

<script setup lang="ts">
const metadataEditorState = useEditState();
const metadataEdits = useMetadataEdits();
</script>
