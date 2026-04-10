"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { api } from "@keeplas/backend/_generated/api";

export function TopNav() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.viewer);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Mobile logo */}
        <div className="md:hidden flex items-center gap-2">
          <Image
            src="/assets/logo/logo.svg"
            alt="Keeplas"
            width={28}
            height={28}
          />
          <span className="font-headline text-lg font-bold text-on-primary">
            Keeplas
          </span>
        </div>

        {/* Spacer for desktop (logo is in sidebar) */}
        <div className="hidden md:block" />

        {/* Right side */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-on-primary/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-sm font-medium text-on-secondary-container">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="hidden sm:block text-sm text-on-primary/90 max-w-[150px] truncate">
              {user?.name || user?.email || "Account"}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl glass-light shadow-lg p-1 animate-slide-down">
              <div className="px-3 py-2 text-sm text-on-surface-variant truncate">
                {user?.email || "No email"}
              </div>
              <div className="h-px bg-surface-container-highest my-1" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error rounded-lg hover:bg-error-container transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
