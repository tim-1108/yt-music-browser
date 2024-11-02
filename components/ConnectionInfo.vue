<template>
	<div ref="wrapper">
		<ButtonTransparent class="relative hover:active:scale-95 transition-transform" @click="isFlyoutOpen = true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="-1 -9 16 10"
				height="25"
				:class="{ blinking: status === 0, full: status === 1, bordered: status === 3 }">
				<path d="M 0 -1 A 1 1 0 0 0 2 -1 L 2 -3 A 1 1 0 0 0 0 -3 L 0 -1" style="--index: 0"></path>
				<path d="M 3 -1 A 1 1 0 0 0 5 -1 L 5 -4 A 1 1 0 0 0 3 -4 L 3 -1" style="--index: 1"></path>
				<path d="M 6 -1 A 1 1 0 0 0 8 -1 L 8 -5 A 1 1 0 0 0 6 -5 L 6 -1" style="--index: 2"></path>
				<path d="M 9 -1 A 1 1 0 0 0 11 -1 L 11 -6 A 1 1 0 0 0 9 -6 L 9 -1" style="--index: 3"></path>
				<path d="M 12 -1 A 1 1 0 0 0 14 -1 L 14 -7 A 1 1 0 0 0 12 -7 L 12 -1" style="--index: 4"></path>
			</svg>
			<div class="absolute rotate-[30deg] bg-red-500 h-1 w-12 drop-shadow top-4 rounded-full" v-if="status === 3"></div>
		</ButtonTransparent>
	</div>
	<Flyout
		:parent="wrapper"
		:vertical-alignment="shouldUseMinimalLayout ? 'top' : 'bottom'"
		v-if="wrapper && isFlyoutOpen"
		@close="isFlyoutOpen = false"
		ref="flyout"
		class="grid gap-2">
		<section>
			<div class="flex justify-between gap-2 flex-wrap items-center">
				<h2>{{ connectedString }}</h2>
				<ButtonDefault v-if="status === 0" :icon="['fas', 'ban']" @click.stop="closeSocket">Cancel</ButtonDefault>
				<ButtonDefault v-else-if="status === 1" :icon="['fas', 'link-slash']" @click.stop="closeSocket">Disconnect</ButtonDefault>
				<ButtonDefault v-else-if="status === 3" :icon="['fas', 'link']" @click.stop="createSocket">Retry</ButtonDefault>
			</div>
			<span>
				Downloader socket address:
				<pre>{{ useRuntimeConfig().public.socketURL }}</pre>
				Download URL:
				<a :href="useRuntimeConfig().public.downloadURL" class="underline">
					<pre>{{ useRuntimeConfig().public.downloadURL }}</pre>
				</a>
			</span>
			<span v-if="status === 1">{{ data.session_id }}</span>
		</section>
		<section class="grid gap-1 max-h-72 overflow-y-scroll" v-if="status === 1">
			<h3>{{ messages.length }} messages have been sent or received</h3>
			<small>Clicking on a message will reveal its data</small>
			<ButtonDefault :icon="['fas', 'trash-can']" class="w-fit" @click="messages = []">Clear all</ButtonDefault>
			<div
				v-for="(message, index) of messagesToShow"
				class="message grid !bg-opacity-30 border-2 rounded-md p-1 cursor-pointer"
				:class="{ incoming: message.type === 'incoming', outgoing: message.type === 'outgoing' }"
				@click.stop="openMessageIndex = openMessageIndex === index ? -1 : index">
				<header class="grid gap-2 items-center">
					<Icon :icon="['fas', message.type === 'incoming' ? 'long-arrow-down' : 'long-arrow-up']"></Icon>
					<pre class="font-bold">{{ message.id }}</pre>
					<small class="text-gray-300 whitespace-nowrap">{{ message.timestamp }}</small>
				</header>
				<main class="w-52 sm:w-auto md:w-72">
					<pre class="dark" v-if="openMessageIndex === index" v-html="syntaxHighlight(message.data)"></pre>
				</main>
			</div>
			<ButtonDefault
				:icon="['fas', 'long-arrow-down']"
				@click.stop="messagesBlock++"
				v-if="reversedMessages.length >= messagesBlock * MESSAGES_PER_BLOCK"
				>Load more messages</ButtonDefault
			>
		</section>
		<section v-if="status === 1">
			<h3>List of registered downloaders ({{ data.downloaders.length }})</h3>
			<ul>
				<li v-for="downloader of data.downloaders">{{ downloader.name }}</li>
			</ul>
		</section>
	</Flyout>
</template>

<script setup lang="ts">
const openMessageIndex = ref(-1);
const status = useSocketState();
const data = useWebSocketData();

const messages = useSocketMessages();
const reversedMessages = computed(() => messages.value.toReversed());
const messagesBlock = ref(1);
const MESSAGES_PER_BLOCK = 100;
const messagesToShow = computed(() => reversedMessages.value.slice(0, messagesBlock.value * MESSAGES_PER_BLOCK));

const flyout = ref(null);

const shouldUseMinimalLayout = useMinimalLayoutToggle();
const wrapper = ref<HTMLElement | null>(null);
const isFlyoutOpen = ref(false);
watch(isFlyoutOpen, (value) => {
	openMessageIndex.value = -1;
	messagesBlock.value = 1;
});

watch(status, async () => {
	messagesBlock.value = 1;
	await sleep(30);
	// @ts-ignore findPosition is exposed in the Flyout component
	flyout.value?.findPosition();
});
function closeSocket() {
	const socket = getWebSocket();
	if (!socket) return;
	// This is so the onClose listener does not try to restore this session
	data.value.is_packaging = true;
	socket.close();
}
const connectedString = computed(() => {
	switch (status.value) {
		case 0:
			return "Connecting...";
		case 1:
			return "Connected";
		case 3:
			return "Connection lost";
	}
});
</script>

<style scoped>
@keyframes blinking {
	0% {
		@apply opacity-25;
	}
	20% {
		@apply opacity-100;
	}
	40% {
		@apply opacity-25;
	}
}
svg.blinking path {
	@apply fill-white opacity-25;
	animation: blinking linear 1000ms infinite;
	animation-delay: calc(var(--index) * 100ms);
}
svg.bordered path {
	@apply fill-transparent stroke-[0.75] stroke-white;
}
@keyframes blend-in {
	from {
		@apply opacity-25;
	}
	to {
		@apply opacity-100;
	}
}
svg.full path {
	@apply fill-white opacity-25;
	animation: blend-in linear 300ms forwards;
	animation-delay: calc(var(--index) * 100ms);
}
section:not(:first-child) {
	@apply border-t-2 py-2;
	border-color: var(--light-border);
}
.message.incoming {
	@apply bg-yellow-600 border-yellow-600;
}
.message.outgoing {
	@apply bg-blue-600 border-blue-600;
}
.message {
	header {
		grid-template-columns: min-content 1fr min-content;
	}
}
</style>
