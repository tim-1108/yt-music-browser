<template>
	<div class="flex gap-2 flex-wrap select-none w-full justify-center">
		<div
			class="option cursor-pointer rounded-lg py-1 px-3 transition-colors shadow-md"
			:selected="enabledOptions.has(option.value)"
			v-for="option of options"
			@click="toggle(option.value)">
			{{ option.text }}
		</div>
	</div>
</template>

<script setup lang="ts">
interface Option {
	text: string;
	value: string;
	enabled?: boolean;
}
const props = defineProps<{ disabled?: boolean; options: Option[] }>();
const enabledOptions = ref(new Set<string>());
const emit = defineEmits<{ update: [values: string[]] }>();

function toggle(value: string) {
	if (enabledOptions.value.has(value)) enabledOptions.value.delete(value);
	else enabledOptions.value.add(value);
	emit("update", Array.from(enabledOptions.value));
}

onMounted(() => {
	for (let i = 0; i < props.options.length; i++) {
		const value = props.options[i];
		if (!value.enabled) continue;
		enabledOptions.value.add(value.value);
	}
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
