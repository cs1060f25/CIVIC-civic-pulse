"use client";

import type { AppState } from "@app/lib/types";

export interface CivicUser {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  createdAt?: string;
  updatedAt?: string;
  savedState?: AppState;
}

export interface AuthState {
  user: CivicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

