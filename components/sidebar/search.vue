<template>
	<div class="flex flex-col gap-2 w-full justify-center">
		<header class="w-full grid gap-2 relative">
			<div class="relative flex items-center w-full h-10 z-30 shadow-md rounded-full text-black">
				<form
					class="h-full w-full rounded-full bg-white"
					@submit.prevent="submitSearch"
					@keydown="navigateInSuggestions"
					@focusin="resultsVisible = true"
					@focusout="unfocus">
					<input
						class="rounded-full pr-9 pl-12 py-2 w-full h-full bg-white text-black"
						placeholder="Search on YouTube Music"
						v-model="content"
						ref="input"
						:disabled="isSearching" />
				</form>
				<Icon class="absolute h-5 w-5 left-4 pointer-events-none" @click="content = ''" :icon="['fas', 'magnifying-glass']"></Icon>
				<Icon class="absolute h-5 w-5 right-4 cursor-pointer" @click="content = ''" :icon="['fas', 'xmark']" v-if="content.length"></Icon>
			</div>
			<div class="results absolute grid rounded-b-xl text-white w-full mt-6 z-20 backdrop-blur-md" v-if="resultsVisible && content.length">
				<div class="text-center py-2 pt-6" v-if="!suggestions.length">No search results</div>
				<button
					class="search-suggestion flex gap-2 items-center py-2 px-4 cursor-pointer"
					@click="(content = suggestion.text) && submitSearch()"
					:selected="selectedItem === index"
					v-for="(suggestion, index) of suggestions">
					<Icon :icon="['fas', 'magnifying-glass']"></Icon>
					<PrettyWrap class="ml-2">
						{{ suggestion.text }}
					</PrettyWrap>
				</button>
			</div>
			<Select :options="typeOptions" :disabled="isSearching" @update="searchFilterUpdate"></Select>
		</header>
		<main class="grid gap-2 w-full max-w-full text-white">
			<LazySearchPreview
				:key="result.id"
				v-for="result of selectedSearchResults"
				:result="result"
				ref="searchPreviewElements"></LazySearchPreview>
			<InfiniteSpinner
				class="justify-self-center mt-4"
				v-if="searchContinuations[searchFilter]?.length || isSearching"
				:size="40"></InfiniteSpinner>
		</main>
	</div>
</template>

<script setup lang="ts">
import type { SearchSuggestion } from "~/server/api/search/suggest.get";
const storedSearchQuery = useSearchQuery();
// If the user switches to the search page, the value would normally disappear.
// It is still stored inside the useState hook, but we cannot write to that directly,
// as it would trigger a search.
const content = ref(toRaw(storedSearchQuery.value) ?? "");
const suggestions = ref<SearchSuggestion[]>([]);

const isSearching = useSearchingState();

const filter = useSearchFilter();

const typeOptions = computed(() => [
	{ text: "Songs", value: "songs", default: filter.value === "songs" },
	{ text: "Albums", value: "albums", default: filter.value === "albums" },
	{ text: "Playlists", value: "playlists", default: filter.value === "playlists" },
	{ text: "Music Videos", value: "videos", default: filter.value === "videos" },
	{ text: "All Videos", value: "videos-classic", default: filter.value === "videos-classic" },
	{ text: "Artists", value: "artists", default: filter.value === "artists" }
]);

const resultsVisible = ref(false);
const input = ref<Nullable<HTMLInputElement>>(null);

/**
 * This function is called when the input element is unfocused.
 * Prevents the dropdown from closing when a suggestion is pressed (would cause
 * the input to close and thus the dropdown at the same time - causing the click
 * event on the button to not fire)
 * @param event
 */
async function unfocus(event: FocusEvent) {
	const { relatedTarget: button } = event;
	if (!(button instanceof HTMLButtonElement)) return (resultsVisible.value = false);
	if (!button.classList.contains("search-suggestion")) return (resultsVisible.value = false);
}

/**
 * The currently selected suggestion index, -1 if none selected
 */
const selectedItem = ref(-1);

/**
 * Defaults to true, only set to false when a suggestion has been selected via the arrow buttons.
 * If the user then types after selecting one, that would of course then search with that.
 * YT does this the same way with their search box.
 */
const shouldRefreshSuggestions = ref(true);

/**
 * Takes the currently inputted value (or the one
 * the user just clicked on) and searches that.
 */
function submitSearch() {
	if (!content.value.length || isSearching.value) return;
	resultsVisible.value = false;
	selectedItem.value = -1;
	useSearchQuery().value = content.value;
}

function searchFilterUpdate(filter: string) {
	useSearchFilter().value = filter as SearchFilter;
}

/**
 * This function is called whenever the user types into the input field. Only triggers
 * on arrows up and down and tabs, used for navigating the suggestions. We do not want
 * to tab out of the search field, so then we prevent default behaviour.
 *
 * Escaping also blurs the input.
 */
function navigateInSuggestions(event: KeyboardEvent) {
	// Sometimes, when opening the input field before the JS is ready, the dropdown would never open
	// due to the focusin event not firing ever
	resultsVisible.value = true;
	const { code } = event;
	if (code === "Escape") return input.value?.blur();
	const highestIndex = suggestions.value.length - 1;
	if (code === "Tab") event.preventDefault();
	if (code === "ArrowUp") {
		shouldRefreshSuggestions.value = false;
		selectedItem.value = clampNumber(selectedItem.value - 1, 0, highestIndex, true);
	}
	if (code === "Tab" || code === "ArrowDown") {
		shouldRefreshSuggestions.value = false;
		selectedItem.value = clampNumber(selectedItem.value + 1, 0, highestIndex, true);
	}
}

watch(selectedItem, (value) => {
	if (value === -1) return;
	const text = suggestions.value[value].text ?? "";
	content.value = text;
});
watch(content, fetchSuggestions);

const lastRefresh = ref(0);
const MIN_INTERVAL = 300;
/**
 * Loads the suggestions for the given query. Only allows for that after
 * MIN_INTERVAL ms after the last request has been sent. This prevents
 * spamming the server from the client-side.
 *
 * Only the SUGGESTION type of responses are added, as others (albums, songs, ...)
 * are not needed here, but get returned by the YT Music API nontheless.
 * @param content The string to search for
 */
async function fetchSuggestions(content: string) {
	if (!shouldRefreshSuggestions.value) return (shouldRefreshSuggestions.value = true);
	const now = performance.now();
	if (now - lastRefresh.value < MIN_INTERVAL) return;
	selectedItem.value = -1;
	if (!content.length) return (suggestions.value = []);
	lastRefresh.value = now;
	try {
		const response = await $fetch("/api/search/suggest", {
			params: {
				q: content
			}
		});
		if (!Array.isArray(response)) return (suggestions.value = []);
		suggestions.value = response.filter((suggestion) => suggestion.type === "SUGGESTION");
	} catch (error) {
		console.error(error);
		return (suggestions.value = []);
	}
}

const searchPreviewElements = ref<HTMLElement[]>([]);
const selectedSearchResults = computed(() => searchResults.value[searchFilter.value]);
const searchResults = useSearchResults();
const searchContinuations = useSearchContinuations();
const searchFilter = useSearchFilter();
</script>

<style scoped>
.results {
	background: #ffffff70;
}
.search-suggestion {
	transition-duration: 150ms;
	transition-timing-function: ease-in-out;
	transition-property: background box-shadow;
}
.search-suggestion:hover,
.search-suggestion:hover:active,
.search-suggestion[selected="true"] {
	@apply shadow;
	background: #ffffff50;
}
.search-suggestion > * {
	transition-duration: 150ms;
	transition-timing-function: ease-in-out;
	transition-property: scale;
}
.search-suggestion:hover:active > * {
	scale: 98%;
}
.search-suggestion:first-child {
	@apply pt-8;
}
.search-suggestion:last-child {
	@apply rounded-b-xl;
}
</style>
