"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";

const navItems = [
  { href: "/search", label: "Search" },
  { href: "/brief", label: "Brief" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color-mix(in_oklab,var(--brand-900)_30%,var(--background))]/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-[--color-brand-100]">
          CivicPulse
        </Link>
        {isAuthenticated && (
          <nav className="flex items-center gap-1 text-sm">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href);
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
        )}
        <div className="flex">
          {isAuthenticated ? (
            <Button variant="secondary" onClick={handleLogout} type="button">
              Log out
            </Button>
          ) : (
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
