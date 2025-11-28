import type { AppState, DocumentType } from "@app/lib/types";

const defaultDocTypes: DocumentType[] = ["Agenda", "Minutes", "Staff Memo"];

export const DEFAULT_APP_STATE: AppState = {
  preferences: null,
  savedItemIds: [],
  followedItemIds: [],
  briefItemIds: [],
  savedBriefs: [],
  searchUi: {
    query: "",
    selectedDocTypes: defaultDocTypes,
    counties: ["Sedgwick County"],
    meetingDateFrom: null,
    meetingDateTo: null,
    selectedIds: [],
  },
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
    searchUi: {
      query: state.searchUi?.query ?? DEFAULT_APP_STATE.searchUi.query,
      selectedDocTypes:
        Array.isArray(state.searchUi?.selectedDocTypes) && state.searchUi!.selectedDocTypes.length > 0
          ? state.searchUi!.selectedDocTypes
          : [...DEFAULT_APP_STATE.searchUi.selectedDocTypes],
      counties: Array.isArray(state.searchUi?.counties) ? state.searchUi!.counties : [...DEFAULT_APP_STATE.searchUi.counties],
      meetingDateFrom: state.searchUi?.meetingDateFrom ?? null,
      meetingDateTo: state.searchUi?.meetingDateTo ?? null,
      selectedIds: Array.isArray(state.searchUi?.selectedIds) ? state.searchUi!.selectedIds : [],
    },
  };
}

