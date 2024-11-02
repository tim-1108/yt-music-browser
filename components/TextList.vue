<template>
	<div class="text-list p-0.5 rounded-md flex flex-wrap gap-1">
		<span v-for="(value, index) of values">
			{{ value }}
			<Icon class="text-sm cursor-pointer" :icon="['fas', 'xmark']" @click="removeValue(value, index)"></Icon>
		</span>
		<form @submit.prevent class="relative w-fit grid items-center" v-if="values.length < (props.max ?? Number.MAX_SAFE_INTEGER)">
			<input v-model="newValue" placeholder="Add..." @keyup.prevent="addValue" />
			<Icon @click="addValue" class="absolute right-2 cursor-pointer" :icon="['fas', 'arrow-right-long']"></Icon>
		</form>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{ startValues?: string[]; max?: number; allowDuplicates?: boolean }>();
const emit = defineEmits<{
	add: [value: string];
	remove: [value: string];
}>();
const values = ref(props.startValues ?? []);
const newValue = ref("");

function removeValue(value: string, index: number) {
	values.value.splice(index, 1);
	emit("remove", value);
}
const lowerCaseList = computed(() => values.value.map((item) => item.toLowerCase()));
function addValue(event: KeyboardEvent) {
	// We do not actually add it to our values list here
	// because we expect the invoker of this component to
	// recieve the add emit and add it to the list which was
	// passed into this component
	// We wish to check if we pass in an event which has a key attribute
	// (when we press the button no KeyboardEvent is submitted)
	const isDuplicate = !props.allowDuplicates && lowerCaseList.value.includes(newValue.value.toLowerCase());
	if (("key" in event && event.key !== "Enter") || !newValue.value.length || isDuplicate) return;
	values.value.push(newValue.value);
	emit("add", newValue.value);
	newValue.value = "";
}
</script>

<style scoped>
span,
input {
	@apply px-2 py-0.5 rounded-md h-fit text-white shadow-md;
	background: var(--button-hover-background);
}
</style>
