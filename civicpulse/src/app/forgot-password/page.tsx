"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Mock password reset - will be implemented later
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For now, just log the email
      console.log("Password reset requested for:", email);
      
      // Show success message
      setSuccess(true);
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[--color-background] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[--color-brand-600] rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[--color-foreground] mb-2">Reset Your Password</h1>
          <p className="text-[--color-muted]">Enter your email address and we'll send you a link to reset your password</p>
        </div>

        {/* Reset Form */}
        <div className="card p-6 mb-6">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[color-mix(in_oklab,var(--danger)_15%,transparent)] border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[--color-foreground] mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[--color-surface] border border-white/10 rounded-lg text-[--color-foreground] placeholder-[--color-muted] focus:outline-none focus:ring-2 focus:ring-[--ring-color] focus:border-transparent transition"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full py-3 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending reset link...
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[color-mix(in_oklab,var(--success)_15%,transparent)] rounded-full mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[--color-foreground] mb-2">Check Your Email</h3>
              <p className="text-[--color-muted] mb-6">
                We&apos;ve sent a password reset link to <span className="font-medium text-[--color-foreground]">{email}</span>
              </p>
              <Button 
                variant="secondary" 
                onClick={() => setSuccess(false)}
                className="mb-4"
              >
                Send another link
              </Button>
            </div>
          )}
        </div>

        {/* Back to Login */}
        <div className="text-center">
          <p className="text-[--color-muted]">
            Don&apos;t have an account?{" "}
            <Link href="/login" className="text-[--color-brand-400] hover:text-[--color-brand-300] font-medium transition">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
