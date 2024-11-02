<template>
	<div class="relative w-full rounded-md z-[3] grid gap-1">
		<BlurredBackground
			class="rounded-md z-[2] min-w-full w-full"
			v-if="job.metadata.cover"
			:image="job.metadata.cover"
			:no-fade="true"
			blur="16px"
			:use-offset="true"></BlurredBackground>
		<main class="flex justify-between items-center z-[3] relative mx-2 my-1">
			<div class="flex gap-2 items-center">
				<Thumbnail :image="job.metadata.cover" class="h-16 rounded-md select-none min-w-fit"></Thumbnail>
				<div class="grid gap-1">
					<span class="font-bold">{{ job.metadata.title }}</span>
					<PrettyWrap>
						<SubtitleList>
							<span v-for="artist of job.artists">
								<NuxtLink :to="generateArtistLink(artist.id)" v-if="artist.id">{{ artist.name }}</NuxtLink>
								<span v-else>{{ /** this is used when a normal video (with only creator) is passed */ artist.name }}</span>
							</span>
							<span v-if="job.album && job.album.name.length">
								<NuxtLink v-if="job.album.id" :to="generatePlaylistLink(job.album.id)">{{ job.album.name }}</NuxtLink>
								<span v-else>{{ /** if the user sets custom metadata, the album might not be stored */ job.album.name }}</span>
							</span>
						</SubtitleList>
					</PrettyWrap>
				</div>
			</div>
			<div v-if="typeof job.queue_position === 'number' && job.queue_position > -1" class="flex gap-1 items-center">
				<ButtonTransparent class="aspect-square" :icon="['fas', 'trash-can']" @click="deleteQueuedJob(job.job_id)"></ButtonTransparent>
				<span>{{ job.queue_position + 1 }}</span>
			</div>
		</main>
		<footer class="px-4 z-[3] mb-2" v-if="job.assigned_downloader">
			<div class="flex gap-2 items-center">
				<div class="bg-white bg-opacity-50 w-full h-1 rounded-full relative overflow-clip">
					<div
						class="h-full rounded-full transition-all bg-white"
						:style="{ width: progress * 100 + '%' }"
						v-if="!job.status_string || simulationInterval"></div>
					<div class="h-full rounded-full w-20 post-processing absolute" v-else></div>
				</div>
				<span class="whitespace-nowrap">
					<span v-if="simulationInterval || !job.status_string"
						>{{ job.status_string ?? "Downloading" }} ({{ Math.round(progress * 100) }}%)</span
					>
					<span v-else>{{ job.status_string }}</span>
				</span>
			</div>
			<p v-if="downloader" class="flex justify-between">
				<span>Assigned to:</span>
				<span class="font-bold">{{ downloader.name }}</span>
			</p>
		</footer>
		<div v-if="job.failed" class="flex justify-between gap-2 flex-wrap items-center pb-2 px-2 z-[3]">
			<i>This download failed</i>
			<ButtonDefault :icon="['fas', 'bug']" @click="showReasonAlert(job.fail_reason)">Show reason</ButtonDefault>
		</div>
	</div>
</template>

<script setup lang="ts">
const EXTRACTING_AUDIO_SECONDS_FACTOR = 0.145;
const STARTING_DOWNLOAD_TIME = 25;
const STEP_INCREMENT = 0.01;

const props = defineProps<{ job: LocalDownloadJob }>();
const data = useWebSocketData();

function showReasonAlert(reason?: string) {
	alert(reason ?? "No reason provided");
}

const strings = ["Starting download", "Extracting audio"];

function handleSimulatedStatus({ status_string: text, length, assigned_downloader }: LocalDownloadJob) {
	// Only for the extracting audio we can make no assumption, as that is dependent on video length
	// Also, length might be 0, undefined or NaN (in such cases we catch it here)
	if (text === null || (!length && text === strings[1]) || !strings.includes(text) || !assigned_downloader) {
		if (simulationInterval.value !== null) {
			clearInterval(simulationInterval.value);
			simulationInterval.value = null;
		}
		simulatedProgress.value = 0;
		return;
	}

	// This might get called multiple times (quite often actually - yeah memory leaks)
	if (simulationInterval.value !== null) return;
	// This is in seconds, not ms
	const timeToFinish =
		text === strings[0] ? STARTING_DOWNLOAD_TIME : EXTRACTING_AUDIO_SECONDS_FACTOR * (length as number); /* has to be number here */
	simulationInterval.value = setInterval(
		() => {
			simulatedProgress.value = clampNumber(simulatedProgress.value + STEP_INCREMENT, 0.0, 1.0);
			if (simulatedProgress.value === 1.0) {
				clearInterval(simulationInterval.value as Timer);
			}
		},
		timeToFinish * 1000 * STEP_INCREMENT
	);
}

watch(props.job, handleSimulatedStatus);

onMounted(() => handleSimulatedStatus(props.job));

const simulationInterval = ref<Timer | null>(null);
const simulatedProgress = ref(0);
const progress = computed(() => props.job.download_percentage ?? simulatedProgress.value);

const downloader = computed(() => data.value.downloaders.find((dl) => dl.id === props.job.assigned_downloader));
</script>

<style scoped>
.post-processing {
	background: white;
	animation: post-processing ease-in infinite 1000ms;
}
@keyframes post-processing {
	from {
		width: 30px;
		left: -30px;
	}
	to {
		left: 100%;
		width: 150px;
	}
}
</style>
