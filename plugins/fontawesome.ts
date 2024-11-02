import { library, config } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
	faCheck,
	faCircleQuestion,
	faLongArrowDown,
	faLongArrowRight,
	faMagnifyingGlass,
	faMusic,
	faPlay,
	faSignal,
	faStop,
	faXmark,
	faImage,
	faPlus,
	faTag,
	faPenToSquare,
	faClone,
	faChevronUp,
	faChevronDown,
	faArrowUpRightFromSquare,
	faGear,
	faSearch,
	faLongArrowUp,
	faList,
	faLinkSlash,
	faLink,
	faTrashCan,
	faBug,
	faEllipsis,
	faBan
} from "@fortawesome/free-solid-svg-icons";

import { faClosedCaptioning } from "@fortawesome/free-regular-svg-icons";

config.autoAddCss = false;
library.add(
	faXmark,
	faMagnifyingGlass,
	faLongArrowRight,
	faPlay,
	faMusic,
	faStop,
	faLongArrowDown,
	faCheck,
	faCircleQuestion,
	faSignal,
	faTrashCan,
	faImage,
	faPlus,
	faTag,
	faPenToSquare,
	faClone,
	faChevronUp,
	faChevronDown,
	faArrowUpRightFromSquare,
	faGear,
	faSearch,
	faLongArrowUp,
	faList,
	faLinkSlash,
	faLink,
	faBug,
	faEllipsis,
	faClosedCaptioning,
	faBan
);

export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.vueApp.component("Icon", FontAwesomeIcon);
});
