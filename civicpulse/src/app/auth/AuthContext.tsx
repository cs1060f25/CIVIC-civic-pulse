"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/**
 * Inner component that calls useGoogleLogin (requires GoogleOAuthProvider).
 * Only rendered on the client after mount.
 */
function GoogleLoginSetup({
  onLoginReady,
}: {
  onLoginReady: (loginFn: () => void) => void;
}) {
  const router = useRouter();
  const { setUser: setUserFromContext } = useInternalAuthSetters();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const googleUserResponse = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );

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
        setUserFromContext(data.user);

        // After successful login, send the user to the search page
        router.replace("/search");
      } catch (error) {
        console.error("Google login failed", error);
      }
    },
    onError: (error) => {
      console.error("Google login error", error);
    },
    flow: "implicit",
    scope: "openid profile email",
  });

  useEffect(() => {
    onLoginReady(login);
  }, [login, onLoginReady]);

  return null;
}

// Internal context for setters (used by GoogleLoginSetup)
const InternalAuthSettersContext = createContext<{
  setUser: (user: CivicUser | null) => void;
} | null>(null);

function useInternalAuthSetters() {
  const ctx = useContext(InternalAuthSettersContext);
  if (!ctx) throw new Error("Missing InternalAuthSettersContext");
  return ctx;
}

interface AuthProviderProps {
  children: React.ReactNode;
  googleOAuthEnabled?: boolean;
}

export function AuthProvider({ children, googleOAuthEnabled = false }: AuthProviderProps) {
  const [user, setUserState] = useState<CivicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const loginRef = useRef<() => void>(() => {
    console.warn("Google login not ready yet");
  });

  useEffect(() => {
    setMounted(true);
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

  const handleLoginReady = useCallback((fn: () => void) => {
    loginRef.current = fn;
  }, []);

  const login = useCallback(() => {
    loginRef.current();
  }, []);

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

  const internalSetters = useMemo(() => ({ setUser }), [setUser]);

  return (
    <AuthContext.Provider value={value}>
      <InternalAuthSettersContext.Provider value={internalSetters}>
        {mounted && googleOAuthEnabled && <GoogleLoginSetup onLoginReady={handleLoginReady} />}
        {children}
      </InternalAuthSettersContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

