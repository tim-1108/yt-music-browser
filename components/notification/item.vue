<template>
	<div
		class="notification-item bg-blue-500 rounded-lg shadow-md cursor-pointer hover:active:scale-95 p-2 opacity-0 select-none"
		:class="{ 'fading-out': isFadingOut }"
		@click="fadeOut"
		:style="{ '--time': item.timeout }">
		<div class="p-2">
			<h3>{{ item.title }}</h3>
			<p v-html="item.description"></p>
		</div>
		<div class="countdown w-full h-1 bg-white rounded-full shadow"></div>
	</div>
</template>

<script setup lang="ts">
import type { UUID } from "~/common/types";
const notifications = useNotifications();
const props = defineProps<{ item: WebNotification; id: UUID }>();

onMounted(async () => {
	if (typeof props.item.timeout !== "number") return;
	await sleep(props.item.timeout * 1000);
	fadeOut();
});

const isFadingOut = ref(false);
async function fadeOut() {
	isFadingOut.value = true;
	await sleep(150);
	notifications.value.delete(props.id);
}
</script>

<style scoped>
@keyframes countdown {
	from {
		@apply w-full;
	}
	to {
		@apply w-0;
	}
}
@keyframes fade-in {
	from {
		@apply opacity-0 translate-y-2.5;
	}
	to {
		@apply opacity-100;
	}
}
@keyframes fade-out {
	from {
		@apply opacity-100;
	}
	to {
		@apply opacity-0 translate-y-2.5;
	}
}
.countdown {
	animation: countdown ease-in forwards;
	animation-duration: calc(var(--time) * 1s);
}
.notification-item {
	animation: fade-in forwards 150ms linear;
}
.notification-item.fading-out {
	animation: fade-out forwards 150ms linear;
}
</style>
