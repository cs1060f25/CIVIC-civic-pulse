"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color-mix(in_oklab,var(--brand-900)_30%,var(--background))]/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-[--color-brand-100]">
          CivicPulse
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg transition-colors hover:bg-white/10 ${
                  active ? "bg-white/10 text-[--color-brand-100]" : "text-[--color-brand-200]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden sm:block">
          <Button>Sign in (mock)</Button>
        </div>
      </div>
    </header>
  );
}
