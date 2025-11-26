"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppState, UserPreferences, SavedBrief, SearchUiState } from "@/lib/types";
import { DEFAULT_APP_STATE, normalizeAppState } from "@/lib/appStateDefaults";
import { useAuth } from "@/auth/AuthContext";

const STORAGE_KEY = "civicpulse_app_state_v1";

type AppContextType = {
  state: AppState;
  setPreferences: (prefs: UserPreferences) => void;
  setSearchUi: (updater: (prev: SearchUiState) => SearchUiState) => void;
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

function loadStateFromStorage(key: string): AppState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_APP_STATE };
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { ...DEFAULT_APP_STATE };
    }
    return normalizeAppState(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to parse stored CivicPulse state", error);
    return { ...DEFAULT_APP_STATE };
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({ ...DEFAULT_APP_STATE });
  const [isHydrated, setIsHydrated] = useState(false);
  const storageKey = user?.googleId ? `${STORAGE_KEY}:${user.googleId}` : STORAGE_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const hydrate = async () => {
      setIsHydrated(false);

      if (user?.googleId) {
        try {
          const params = new URLSearchParams({ googleId: user.googleId });
          const response = await fetch(`/api/user/state?${params.toString()}`, {
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`Failed to load remote state (${response.status})`);
          }

          const data = await response.json();
          if (!cancelled) {
            const normalized = normalizeAppState(data.state);
            setState(normalized);
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          }
        } catch (error) {
          console.error("Failed to load user state, falling back to local storage", error);
          if (!cancelled) {
            setState(loadStateFromStorage(storageKey));
          }
        } finally {
          if (!cancelled) {
            setIsHydrated(true);
          }
        }
      } else {
        if (!cancelled) {
          setState(loadStateFromStorage(storageKey));
          setIsHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user?.googleId, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to persist CivicPulse state locally", error);
    }
  }, [state, storageKey, isHydrated]);

  useEffect(() => {
    if (!user?.googleId || !isHydrated) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch("/api/user/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ googleId: user.googleId, state }),
        signal: controller.signal,
      }).catch((error) => {
        console.error("Failed to sync user state", error);
      });
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [state, user?.googleId, isHydrated]);

  const api = useMemo<AppContextType>(() => ({
    state,
    setPreferences: (prefs) =>
      setState((s) => ({
        ...s,
        preferences: prefs,
      })),
    setSearchUi: (updater) =>
      setState((s) => ({
        ...s,
        searchUi: updater(s.searchUi),
      })),
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
        briefItemIds: s.briefItemIds.includes(id) ? s.briefItemIds : [...s.briefItemIds, id],
      })),
    removeFromBrief: (id) =>
      setState((s) => ({
        ...s,
        briefItemIds: s.briefItemIds.filter((x) => x !== id),
      })),
    saveBrief: (name: string, description: string) =>
      setState((s) => {
        const newBrief: SavedBrief = {
          id: `brief-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          name,
          description,
          itemIds: [...s.briefItemIds],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documentCount: s.briefItemIds.length,
        };
        return {
          ...s,
          savedBriefs: [...s.savedBriefs, newBrief],
        };
      }),
    loadBrief: (briefId: string) =>
      setState((s) => {
        const brief = s.savedBriefs.find((b) => b.id === briefId);
        if (!brief) return s;
        return {
          ...s,
          briefItemIds: [...brief.itemIds],
        };
      }),
    deleteBrief: (briefId: string) =>
      setState((s) => ({
        ...s,
        savedBriefs: s.savedBriefs.filter((brief) => brief.id !== briefId),
      })),
    clearBrief: () =>
      setState((s) => ({
        ...s,
        briefItemIds: [],
      })),
  }), [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
