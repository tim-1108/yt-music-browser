<template>
	<div class="flex gap-2 flex-wrap select-none w-full justify-center">
		<div
			class="option cursor-pointer rounded-full py-1 px-3 transition-colors shadow-md"
			:selected="index === selected"
			v-for="(option, index) of options"
			@click="select(index)">
			{{ option.text }}
		</div>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{ disabled?: boolean; options: { text: string; value: string; default?: boolean }[] }>();
const selected = ref(-1);

const emit = defineEmits<{ update: [value: string] }>();

function select(index: number) {
	if (selected.value === index || props.disabled) return;
	selected.value = index;
	emit("update", props.options[index].value);
}

onMounted(() => {
	const defaultIndex = props.options.findIndex((x) => x.default);
	selected.value = Math.max(defaultIndex, 0);
});
</script>

<style scoped>
.option:not([selected="true"]):hover {
	background: var(--button-hover-background);
}
.option[selected="true"] {
	@apply bg-white text-black;
}
.option:not([selected="true"]) {
	background: var(--button-background);
}
</style>
