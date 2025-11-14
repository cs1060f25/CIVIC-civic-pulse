"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppState, UserPreferences } from "@/lib/types";

const STORAGE_KEY = "civicpulse_app_state_v1";

const defaultState: AppState = {
  preferences: null,
  savedItemIds: [],
  followedItemIds: [],
  briefItemIds: [],
};

type AppContextType = {
  state: AppState;
  setPreferences: (prefs: UserPreferences) => void;
  toggleSaved: (id: string) => void;
  toggleFollowed: (id: string) => void;
  addToBrief: (id: string) => void;
  removeFromBrief: (id: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        setState(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const api = useMemo<AppContextType>(() => ({
    state,
    setPreferences: (prefs) => setState((s) => ({ ...s, preferences: prefs })),
    toggleSaved: (id) =>
      setState((s) => ({
        ...s,
        savedItemIds: s.savedItemIds.includes(id)
          ? s.savedItemIds.filter((x) => x !== id)
          : [...s.savedItemIds, id],
      })),
    toggleFollowed: (id) =>
      setState((s) => ({
        ...s,
        followedItemIds: s.followedItemIds.includes(id)
          ? s.followedItemIds.filter((x) => x !== id)
          : [...s.followedItemIds, id],
      })),
    addToBrief: (id) =>
      setState((s) => ({
        ...s,
        briefItemIds: s.briefItemIds.includes(id)
          ? s.briefItemIds
          : [...s.briefItemIds, id],
      })),
    removeFromBrief: (id) =>
      setState((s) => ({
        ...s,
        briefItemIds: s.briefItemIds.filter((x) => x !== id),
      })),
  }), [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
