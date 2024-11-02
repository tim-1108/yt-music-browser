<template>
	<div class="wrapper p-4 gap-4">
		<LegalDisclaimer v-if="!hasConfirmedLegal"></LegalDisclaimer>
		<NavBar :class="{ 'lower-down': embeddedVideo !== null }"></NavBar>
		<section id="playlist" :class="{ hidden: shouldUseMinimalLayout && sidebarSelection !== 'main' }">
			<slot />
		</section>
		<section
			ref="searchSection"
			id="search"
			class="md:w-112 flex flex-wrap gap-2 p-4 place-content-start"
			:class="{ smaller: embeddedVideo !== null, 'hidden-section': sidebarSelection === 'main' }"
			@scroll="onSearchScroll">
			<SidebarSearch :class="{ hidden: sidebarSelection !== 'search' }"></SidebarSearch>
			<SidebarDownloads :class="{ 'hidden-section': sidebarSelection !== 'downloads' }"></SidebarDownloads>
			<SidebarSettings :class="{ hidden: sidebarSelection !== 'settings' }"></SidebarSettings>
		</section>
		<SidebarEmbed v-if="embeddedVideo !== null" id="embed"></SidebarEmbed>
		<footer class="fixed bottom-24 md:bottom-6 grid gap-2 z-50 w-full justify-start md:justify-center pointer-events-none">
			<MetadataEditInfo v-if="metadataEdits.size && !metadataEditorState"></MetadataEditInfo>
			<ThumbnailChooserInfo v-if="thumbnailChooser !== null"></ThumbnailChooserInfo>
		</footer>
		<MetadataEditor v-if="editState"></MetadataEditor>
		<NotificationWrapper></NotificationWrapper>
	</div>
</template>

<script setup lang="ts">
import type { SearchResult } from "~/server/types";

const legalCookie = useLegalState();
const hasConfirmedLegal = computed(() => legalCookie.value === "yes");

const embeddedVideo = useEmbeddedVideo();

const metadataEdits = useMetadataEdits();
const metadataEditorState = useEditState();

const sidebarSelection = useSidebarSelection();
const shouldUseMinimalLayout = useMinimalLayoutToggle();

const searchQuery = useSearchQuery();
const searchFilter = useSearchFilter();
const errors = useErrorStates();

const isSearching = useSearchingState();
const searchResults = useSearchResults();
const searchContinuations = useSearchContinuations();

const SEARCH_CONTINUATION_THRESHOLD = 500;
const consumedContinuations: string[] = [];
const searchSection = ref<Nullable<HTMLElement>>(null);
async function onSearchScroll() {
	if (searchSection.value === null || isSearching.value || sidebarSelection.value !== "search") return;
	const { scrollTop, scrollHeight, clientHeight } = searchSection.value;
	const maxScrollPosition = scrollHeight - clientHeight;
	if (maxScrollPosition - SEARCH_CONTINUATION_THRESHOLD > scrollTop) return;
	const hasBeenConsumed = consumedContinuations.includes(searchFilter.value);
	if (hasBeenConsumed) return;
	consumedContinuations.push(searchFilter.value);
	await searchForQuery(true);
	consumedContinuations.splice(consumedContinuations.indexOf(searchFilter.value), 1);
}

watch(searchFilter, () => searchForQuery());
watch(searchQuery, () => {
	resetSearchResults();
	searchForQuery();
});

async function searchForQuery(shouldUseContinuation: boolean = false) {
	if (!searchQuery.value?.length) return;
	if (!shouldUseContinuation && searchResults.value[searchFilter.value].length) return onSearchScroll();
	if (isSearching.value) return console.warn("Shouldn't be possible to search at given moment...");
	const continuationValue = searchContinuations.value[searchFilter.value];
	if (shouldUseContinuation && !continuationValue?.length) return;
	const continuation = shouldUseContinuation ? { continuation: searchContinuations.value[searchFilter.value] } : {};
	isSearching.value = true;
	try {
		const response = await $fetch<{ items: SearchResult[]; continuations: string[] }>(`/api/search/${searchFilter.value}`, {
			query: { q: searchQuery.value, ...continuation }
		});
		searchContinuations.value[searchFilter.value] = response.continuations[0] ?? null;
		(searchResults.value[searchFilter.value] as SearchResult[]) = searchResults.value[searchFilter.value].concat(
			response.items as YouFindThatDamnSearchResultType[]
		);
	} catch (error) {
		console.error(error);
		errors.value.search = searchForQuery;
	}
	isSearching.value = false;
	await nextTick();
	onSearchScroll();
}

const thumbnailChooser = useThumbnailChooser();
const editState = useEditState();

const listeners = ref<(Function | null)[]>([]);

onMounted(() => {
	if (!hasConfirmedLegal.value) return;
	createSocket();
	listeners.value = [
		registerWindowListener("beforeunload", () => {
			const socket = getWebSocket();
			socket?.close();
		}),
		registerWindowListener("offline", () => {
			getWebSocket()?.close();
			addNotification({ title: "Lost network connection", timeout: 3 });
		}),
		registerWindowListener("online", () => {
			addNotification({ title: "Network connection re-established", timeout: 3 });
		})
	];
});
onBeforeUnmount(() => {
	for (const listener of listeners.value) {
		listener?.();
	}
});
</script>

<style scoped>
.wrapper {
	display: grid;
	width: 100vw;
	height: 100%;
	grid-template-rows: 1fr min-content;
}
section {
	@apply rounded-lg min-h-0 p-4 overflow-auto;
	background-color: var(--section-background);
	scrollbar-gutter: stable;
	grid-row: 1 / 2;
}
nav {
	grid-row: 2 / 3;
}
nav.lower-down {
	grid-row: 3 / 4;
}
section#embed {
	grid-row: 2 / 3;
}
@media (min-width: 768px) {
	.wrapper {
		grid-template-rows: auto 1fr;
		grid-template-columns: auto 1fr;
		height: 100vh;
	}
	section#search {
		grid-row: 2 / 4;
		grid-column: 1 / 2;
	}
	section#search.smaller {
		grid-row: 2 / 3;
	}
	nav {
		grid-row: 1 / 2 !important;
		grid-column: 1 / 2;
	}
	section#playlist {
		grid-row: 1 / 4;
		grid-column: 2 / 3;
	}
	section#embed {
		grid-row: 3 / 4;
		grid-column: 1 / 2;
	}
}
.hidden-section {
	/* this appears to bypass a Vue check whether the element is actually visible (we need the code in the previews to always run) */
	@apply hidden;
}
</style>
