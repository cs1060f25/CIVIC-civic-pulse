"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import { GoogleLoginButton } from "@/auth/GoogleLoginButton";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/search");
    }
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen bg-[--color-background] flex items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sign in to CivicPulse</h1>
          <p className="text-[--color-muted]">
            Authenticate with Google to access search, build briefs, and sync your workspace across sessions.
          </p>
        </div>

        <div className="space-y-4 max-w-sm mx-auto mt-4">
          <GoogleLoginButton />
          <p className="text-sm text-[--color-muted]">
            We only use your Google profile to verify identity and personalize your CivicPulse workspace.
          </p>
          {isLoading && (
            <p className="text-xs uppercase tracking-wide text-[--color-muted]">
              Connecting to Google…
            </p>
          )}
        </div>

        <div className="text-left text-sm text-[--color-muted] space-y-2 border border-white/10 rounded-2xl p-6 bg-white/5">
          <p className="font-semibold text-[--color-foreground]">After you sign in we’ll remember:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Saved briefs and selected documents</li>
            <li>Custom tags or notes you attach to items</li>
            <li>Any preferences you set inside Search</li>
          </ul>
          <p className="text-xs text-[--color-muted]">
            Need help? Contact the CivicPulse team to request access or reset your data.
          </p>
        </div>
      </div>
    </main>
  );
}
