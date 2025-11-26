"use client";

import { ReactNode, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/auth/AuthContext";
import { AppProvider } from "@/lib/state";

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      console.warn(
        "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google login will not function until this environment variable is provided."
      );
    }
  }, [clientId]);

  if (!clientId) {
    return (
      <AuthProvider>
        <AppProvider>{children}</AppProvider>
      </AuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <AppProvider>{children}</AppProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

