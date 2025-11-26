"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useGoogleLogin } from "@react-oauth/google";
import type { CivicUser, AuthState } from "./types";
import { useRouter } from "next/navigation";

const USER_STORAGE_KEY = "civicpulse_google_user";

interface AuthContextType extends AuthState {
  login: () => void;
  logout: () => void;
  setUser: (user: CivicUser | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<CivicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      if (raw) {
        setUserState(JSON.parse(raw));
      }
    } catch (error) {
      console.error("Failed to parse stored user", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistUser = useCallback((nextUser: CivicUser | null) => {
    if (typeof window === "undefined") return;
    try {
      if (nextUser) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to persist user", error);
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setIsLoading(true);
        const googleUserResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!googleUserResponse.ok) {
          throw new Error("Failed to fetch Google profile");
        }

        const googleProfile = await googleUserResponse.json();
        const payload = {
          googleId: googleProfile.sub as string,
          email: googleProfile.email as string,
          name: googleProfile.name as string,
          picture: googleProfile.picture as string | undefined,
        };

        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to persist user (${response.status})`);
        }

        const data = await response.json();
        setUserState(data.user);
        persistUser(data.user);

        // After successful login, send the user to the search page
        router.replace("/search");
      } catch (error) {
        console.error("Google login failed", error);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error("Google login error", error);
    },
    flow: "implicit",
    scope: "openid profile email",
  });

  const logout = useCallback(() => {
    setUserState(null);
    persistUser(null);
  }, [persistUser]);

  const setUser = useCallback(
    (nextUser: CivicUser | null) => {
      setUserState(nextUser);
      persistUser(nextUser);
    },
    [persistUser]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      setUser,
    }),
    [user, isLoading, login, logout, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

