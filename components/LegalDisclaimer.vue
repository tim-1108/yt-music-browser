<template>
	<dialog class="p-4 rounded-lg text-white md:max-w-[75vw] outline-none grid gap-2" ref="dialog">
		<h1>Legal disclaimer</h1>
		<p>The services provided on this website allow users to download YouTube videos as MP3 files for <b>personal use only</b>.</p>
		<p>By using this website, you acknowledge and agree to the following terms:</p>
		<ul class="list-decimal grid gap-2">
			<li v-for="item of listItems">
				<p>
					<b>{{ item.title }}:</b>
					{{ item.description }}
				</p>
			</li>
		</ul>
		<p>Enjoy!</p>
		<ButtonBig @click="confirm" :icon="['fas', 'check']">I confirm that I have read these terms and accept them</ButtonBig>
	</dialog>
</template>

<script setup lang="ts">
const confirmation = useLegalState();
async function confirm() {
	confirmation.value = "yes";
	await nextTick();
	location.reload();
}
const listItems = [
	{
		title: "User Responsibility",
		description:
			"The site owners bear no responsibility for any misconduct or illegal activities carried out by users of this service. It is the sole responsibility of the user to ensure that their actions comply with all applicable laws and regulations."
	},
	{
		title: "Copyright Violations",
		description:
			"The site owners do not support or condone the unauthorized download, distribution, or use of copyrighted material. Users are solely responsible for ensuring that they have the right to download any content from YouTube. This site only acts as a intermediary between YouTube and the user. Any copyright violations resulting from the use of this service are the sole responsibility of the user."
	},
	{
		title: "Do not redistribute",
		description:
			"Redistribution of files downloaded from this website is prohibited. Users must not share, distribute, or sell the downloaded content in any form. This service is intended for personal use only, and any commercial or public use is not permitted."
	}
];
const dialog = ref<HTMLDialogElement | null>(null);
onMounted(() => {
	if (!dialog.value) return;
	dialog.value.showModal();
	// Calling event.preventDefault still closes the dialog backdrop
	dialog.value.addEventListener("close", () => dialog.value?.showModal());
});
</script>

<style scoped>
dialog {
	background: var(--section-background);
}
</style>
