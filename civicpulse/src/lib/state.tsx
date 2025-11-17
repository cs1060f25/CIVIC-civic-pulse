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

export interface SavedBrief {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export interface AppState {
  preferences: UserPreferences;
  savedItemIds: string[];
  followedItemIds: string[];
  briefItemIds: string[];
  savedBriefs: SavedBrief[];
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
  savedBriefs: [],
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
  saveBrief: (name: string, description: string) => void;
  loadBrief: (briefId: string) => void;
  deleteBrief: (briefId: string) => void;
  clearBrief: () => void;
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
          savedBriefs: parsedState.savedBriefs || [],
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

  const saveBrief = (name: string, description: string) => {
    const newBrief: SavedBrief = {
      id: `brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      itemIds: [...state.briefItemIds],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentCount: state.briefItemIds.length,
    };

    setState(prev => ({
      ...prev,
      savedBriefs: [...prev.savedBriefs, newBrief],
    }));
  };

  const loadBrief = (briefId: string) => {
    const brief = state.savedBriefs.find(b => b.id === briefId);
    if (brief) {
      setState(prev => ({
        ...prev,
        briefItemIds: [...brief.itemIds],
      }));
    }
  };

  const deleteBrief = (briefId: string) => {
    setState(prev => ({
      ...prev,
      savedBriefs: prev.savedBriefs.filter(brief => brief.id !== briefId),
    }));
  };

  const clearBrief = () => {
    setState(prev => ({
      ...prev,
      briefItemIds: [],
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
      saveBrief,
      loadBrief,
      deleteBrief,
      clearBrief,
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
