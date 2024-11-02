<template>
	<div class="thumbnail-wrapper grid relative">
		<NuxtImg
			@error="shouldShowPlaceholder = true"
			@load="shouldShowPlaceholder = false"
			v-if="image && !shouldShowPlaceholder"
			class="h-[inherit] w-[inherit] min-w-[inherit] min-h-[inherit] rounded-[inherit] shadow-md"
			:src="image"></NuxtImg>
		<Icon v-else class="place-self-center text-white" :icon="['fas', 'image']"></Icon>
		<div
			class="absolute h-full w-full grid place-content-center cursor-pointer bg-black bg-opacity-0 hover:bg-opacity-50 rounded-[inherit]"
			v-if="thumbnailChooser !== null && image"
			@click="chooseThumbnail(image)">
			<Icon class="add opacity-0 z-20 text-2xl" :icon="['fas', 'plus']"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
const thumbnailChooser = useThumbnailChooser();
const metadataList = useMetadataEdits();
const editState = useEditState();
const shouldShowPlaceholder = ref(false);
defineProps<{ image?: string }>();
function chooseThumbnail(image: string) {
	const id = thumbnailChooser.value;
	if (!id) return;
	const metadata = metadataList.value.get(id);
	if (!metadata) return;
	metadata.metadata.cover = image;
	editState.value = true;
}
</script>

<style scoped>
.thumbnail-wrapper:hover .add {
	@apply opacity-100;
}
</style>
