export const useErrorStates = () => useState<{ [key: string]: Function | null }>("error-states", () => ({}));

type ErrorState = "search";
