<template>
	<div class="w-full grid gap-2">
		<h2>Steps</h2>
		<ul class="list-decimal ml-6">
			<li>Find your favourite music</li>
			<li>Download individual songs or full albums</li>
			<li>Wait until all downloads on this page have finished</li>
			<li>Press the <b>Download All</b> button</li>
			<li>Enjoy!</li>
		</ul>
		<p class="text-center">The server will package everything and send you a <b>.zip</b> file</p>
		<ButtonBig :icon="['fas', 'long-arrow-down']" :disabled="isButtonDisabled" @click="requestPackaging">
			<span v-if="isButtonDisabled">
				{{ status !== 1 ? "Not Connected" : data.is_packaging ? "Packaging Downloads" : "Please Wait" }}
			</span>
			<span v-else>Download All</span>
		</ButtonBig>
		<header>
			<h2>Currently downloading</h2>
			<QuestionMark>Including from you and others, only a certain amount of videos can be downloaded at a time.</QuestionMark>
		</header>
		<div class="grid gap-1" v-if="current.size">
			<SongDownloadInfo v-for="[videoId, job] of current" :job="job" :key="job.job_id"></SongDownloadInfo>
		</div>
		<p v-else>-</p>
		<header>
			<h2>Queue ({{ queue.size }})</h2>
			<QuestionMark>Your items in the global queue will be listed here.</QuestionMark>
		</header>
		<div class="grid gap-1" v-if="queue.size">
			<SongDownloadInfo v-for="[videoId, job] of queue" :job="job" :key="job.job_id"></SongDownloadInfo>
		</div>
		<p v-else>-</p>
		<header>
			<h2>Finished ({{ finished.size }})</h2>
			<QuestionMark>Anything that has been downloaded onto the server is listed here and ready for you to download.</QuestionMark>
		</header>
		<div class="grid gap-1" v-if="finished.size">
			<SongDownloadInfo v-for="[videoId, job] of finished" :job="job"></SongDownloadInfo>
		</div>
		<p v-else>-</p>
	</div>
</template>

<script setup lang="ts">
const finished = useFinishedDownloads();
const queue = useDownloadQueue();
const current = useCurrentDownloads();
const data = useWebSocketData();
const status = useSocketState();
const isButtonDisabled = computed(() => status.value !== WebSocket.OPEN || data.value.is_packaging || !!queue.value.size || !!current.value.size);
</script>

<style scoped>
header {
	@apply flex gap-2 items-center;
}
</style>
