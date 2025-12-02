"use client";

import { forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }>(
  function Button({ className = "", variant = "primary", ...props }, ref) {
    const base = "inline-flex items-center justify-center rounded-lg text-sm px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0";
    const styles =
      variant === "primary"
        ? "bg-blue-600 hover:bg-blue-500 text-white"
        : variant === "secondary"
        ? "border border-gray-300 bg-white hover:bg-gray-50 text-gray-900"
        : "hover:bg-gray-100 text-gray-900";
    return <button ref={ref} className={`${base} ${styles} ${className}`} {...props} />;
  }
);

export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; className?: string }) {
  const base = "inline-flex items-center justify-center rounded-lg text-sm px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring-color] shadow-sm hover:shadow-md hover:-translate-y-[1px]";
  const styles =
    variant === "primary"
      ? "bg-[--color-brand-600] hover:bg-[--color-brand-500] text-white border border-[color-mix(in_oklab,var(--brand-300)_35%,transparent)]"
      : variant === "secondary"
      ? "border border-white/20 bg-surface/60 hover:bg-white/10"
      : "hover:bg-white/10";
  return (
    <a href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </a>
  );
}

export function Badge({ children, color = "brand" as "brand" | "success" | "warning" | "danger" }: { children: React.ReactNode; color?: "brand" | "success" | "warning" | "danger" }) {
  const colors: Record<string, string> = {
    brand: "bg-blue-100 text-blue-800 border-blue-200",
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    danger: "bg-red-100 text-red-800 border-red-200",
  };
  return <span className={`px-2 py-1 rounded-md text-xs border ${colors[color]}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="section-title">{title}</div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

