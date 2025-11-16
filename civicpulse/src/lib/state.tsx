"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Types for our state management
export interface UserPreferences {
  workspaceName: string;
  jurisdictions: string[]; // counties or cities
  topics: string[]; // keywords/taxonomy
  alertCadence: "Off" | "Daily" | "Weekly";
  impactThreshold: "Low" | "Medium" | "High";
}

export interface AppState {
  preferences: UserPreferences;
  savedItemIds: string[];
  followedItemIds: string[];
  briefItemIds: string[];
}

// Default preferences
const defaultPreferences: UserPreferences = {
  workspaceName: "My Workspace",
  jurisdictions: [],
  topics: [],
  alertCadence: "Off",
  impactThreshold: "Low",
};

// Default state
const defaultState: AppState = {
  preferences: defaultPreferences,
  savedItemIds: [],
  followedItemIds: [],
  briefItemIds: [],
};

// Storage key for localStorage
const STORAGE_KEY = "civicpulse-state";

// Context
const AppContext = createContext<{
  state: AppState;
  setPreferences: (prefs: UserPreferences) => void;
  toggleSaved: (id: string) => void;
  toggleFollowed: (id: string) => void;
  addToBrief: (id: string) => void;
  removeFromBrief: (id: string) => void;
} | null>(null);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        setState({
          ...defaultState,
          ...parsedState,
          preferences: {
            ...defaultPreferences,
            ...parsedState.preferences,
          },
        });
      }
    } catch (error) {
      console.warn("Failed to load state from localStorage:", error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to save state to localStorage:", error);
    }
  }, [state]);

  const setPreferences = (preferences: UserPreferences) => {
    setState(prev => ({ ...prev, preferences }));
  };

  const toggleSaved = (id: string) => {
    setState(prev => ({
      ...prev,
      savedItemIds: prev.savedItemIds.includes(id)
        ? prev.savedItemIds.filter(savedId => savedId !== id)
        : [...prev.savedItemIds, id],
    }));
  };

  const toggleFollowed = (id: string) => {
    setState(prev => ({
      ...prev,
      followedItemIds: prev.followedItemIds.includes(id)
        ? prev.followedItemIds.filter(followedId => followedId !== id)
        : [...prev.followedItemIds, id],
    }));
  };

  const addToBrief = (id: string) => {
    setState(prev => ({
      ...prev,
      briefItemIds: prev.briefItemIds.includes(id)
        ? prev.briefItemIds
        : [...prev.briefItemIds, id],
    }));
  };

  const removeFromBrief = (id: string) => {
    setState(prev => ({
      ...prev,
      briefItemIds: prev.briefItemIds.filter(briefId => briefId !== id),
    }));
  };

  return (
    <AppContext.Provider value={{
      state,
      setPreferences,
      toggleSaved,
      toggleFollowed,
      addToBrief,
      removeFromBrief,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the app state
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return context;
}
