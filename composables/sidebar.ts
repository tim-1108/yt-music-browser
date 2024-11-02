export const useSidebarSelection = () => useState<SidebarOption>("sidebar-selection", () => "search");
export type SidebarOption = "search" | "downloads" | "settings" | "main";

export const useMinimalLayoutToggle = () => useState("minimal-layout-toggle", () => false);
