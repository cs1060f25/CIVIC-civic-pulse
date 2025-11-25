"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppState, UserPreferences, SavedBrief } from "@/lib/types";

const STORAGE_KEY = "civicpulse_app_state_v1";

const defaultState: AppState = {
  preferences: null,
  savedItemIds: [],
  followedItemIds: [],
  briefItemIds: [],
  savedBriefs: [],
};

type AppContextType = {
  state: AppState;
  setPreferences: (prefs: UserPreferences) => void;
  toggleSaved: (id: string) => void;
  toggleFollowed: (id: string) => void;
  addToBrief: (id: string) => void;
  removeFromBrief: (id: string) => void;
  saveBrief: (name: string, description: string) => void;
  loadBrief: (briefId: string) => void;
  deleteBrief: (briefId: string) => void;
  clearBrief: () => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window === "undefined") return;
    
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        // Ensure all required properties exist with proper defaults
        setState({
          ...defaultState,
          ...parsed,
          preferences: parsed.preferences || defaultState.preferences,
          savedItemIds: parsed.savedItemIds || defaultState.savedItemIds,
          followedItemIds: parsed.followedItemIds || defaultState.followedItemIds,
          briefItemIds: parsed.briefItemIds || defaultState.briefItemIds,
          savedBriefs: parsed.savedBriefs || defaultState.savedBriefs,
        });
      }
    } catch {
      // If localStorage is corrupted, reset to default state
      setState(defaultState);
    }
  }, []);

  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window === "undefined") return;
    
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
    saveBrief: (name: string, description: string) => {
      const newBrief: SavedBrief = {
        id: `brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        itemIds: [...state.briefItemIds],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentCount: state.briefItemIds.length,
      };
      setState((s) => ({
        ...s,
        savedBriefs: [...s.savedBriefs, newBrief],
      }));
    },
    loadBrief: (briefId: string) => {
      const brief = state.savedBriefs.find((b) => b.id === briefId);
      if (brief) {
        setState((s) => ({
          ...s,
          briefItemIds: [...brief.itemIds],
        }));
      }
    },
    deleteBrief: (briefId: string) => {
      setState((s) => ({
        ...s,
        savedBriefs: s.savedBriefs.filter((brief) => brief.id !== briefId),
      }));
    },
    clearBrief: () => {
      setState((s) => ({
        ...s,
        briefItemIds: [],
      }));
    },
  }), [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
