import type { AppState } from "@/lib/types";

export const DEFAULT_APP_STATE: AppState = {
  preferences: null,
  savedItemIds: [],
  followedItemIds: [],
  briefItemIds: [],
  savedBriefs: [],
};

export function normalizeAppState(state?: Partial<AppState> | null): AppState {
  if (!state) {
    return { ...DEFAULT_APP_STATE };
  }

  return {
    preferences: state.preferences ?? null,
    savedItemIds: Array.isArray(state.savedItemIds) ? state.savedItemIds : [],
    followedItemIds: Array.isArray(state.followedItemIds) ? state.followedItemIds : [],
    briefItemIds: Array.isArray(state.briefItemIds) ? state.briefItemIds : [],
    savedBriefs: Array.isArray(state.savedBriefs) ? state.savedBriefs : [],
  };
}

