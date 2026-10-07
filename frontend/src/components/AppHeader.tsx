"use client";

import Link from "next/link";
import { HelpCircle, Sparkles } from "lucide-react";
import { Logo } from "./Logo";
import { Menu } from "./ui/Menu";
import { useToast } from "./ui/Toast";

export function Avatar({ name = "Alex Creator", size = 32 }: { name?: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-violet text-[12px] font-semibold text-white"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function AppHeader() {
  const toast = useToast();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:px-6">
      <Link href="/workspace" aria-label="Home">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <button
          onClick={() => toast.info("Plans & billing are coming soon")}
          className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-violet hover:bg-violet-soft sm:inline-flex"
        >
          <Sparkles size={14} /> Upgrade
        </button>
        <button aria-label="Help" onClick={() => toast.info("Help center is coming soon")} className="rounded-lg p-2 text-ink-2 hover:bg-ink/5">
          <HelpCircle size={18} />
        </button>
        <Menu
          trigger={(p) => (
            <button {...p} aria-label="Account" className="rounded-full">
              <Avatar />
            </button>
          )}
          items={[
            { label: "Alex Creator · creator@formwise.app", disabled: true },
            { divider: true, label: "" },
            { label: "Account settings", onClick: () => toast.info("Account settings are coming soon") },
            { label: "Team members", onClick: () => toast.info("Team collaboration is coming soon") },
            { label: "Log out", onClick: () => toast.info("Auth is simplified — you're always logged in as the demo creator") },
          ]}
          width={260}
        />
      </div>
    </header>
  );
}
