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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[--color-brand-600] rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Sign in to CivicPulse</h1>
          <p className="text-[--color-muted]">
            Authenticate with Google to access search, build briefs, and sync your workspace across sessions.
          </p>
        </div>

        <div className="card p-8 space-y-6">
          <GoogleLoginButton className="text-base py-6" />
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
