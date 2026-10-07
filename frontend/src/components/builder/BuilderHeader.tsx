"use client";

import { AlertCircle, Check, ChevronLeft, Cloud, Eye, Globe, Link2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { publicUrl } from "@/lib/format";
import type { FormDetail } from "@/lib/types";
import { Avatar } from "../AppHeader";
import { LogoMark } from "../Logo";
import { Menu } from "../ui/Menu";
import { Button } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import type { SaveState } from "./useFormEditor";

export type Tab = "create" | "connect" | "share" | "results";
const TABS: { id: Tab; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "connect", label: "Connect" },
  { id: "share", label: "Share" },
  { id: "results", label: "Results" },
];

export function BuilderHeader({
  form,
  tab,
  onTab,
  saveState,
  saveError,
  workspaceName,
  onRename,
  onPreview,
  onPublish,
  onUnpublish,
}: {
  form: FormDetail;
  tab: Tab;
  onTab: (t: Tab) => void;
  saveState: SaveState;
  saveError: string | null;
  workspaceName?: string;
  onRename: (title: string) => void;
  onPreview: () => void;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(form.title);
  const [syncedTitle, setSyncedTitle] = useState(form.title);
  const [publishing, setPublishing] = useState(false);
  if (form.title !== syncedTitle) {
    setSyncedTitle(form.title);
    setTitle(form.title);
  }

  const commitTitle = () => {
    const t = title.trim();
    if (!t) setTitle(form.title);
    else if (t !== form.title) onRename(t);
  };

  return (
    <header className="z-30 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-surface px-3">
      <div className="flex min-w-0 items-center gap-1">
        <Link href={`/workspace?ws=${form.workspace_id}`} className="flex items-center rounded-lg p-1.5 hover:bg-ink/5" aria-label="Back to workspace">
          <LogoMark size={26} />
        </Link>
        <Link href={`/workspace?ws=${form.workspace_id}`} className="hidden items-center gap-0.5 truncate rounded px-1.5 py-1 text-[13px] text-muted hover:bg-ink/5 hover:text-ink lg:flex">
          <ChevronLeft size={14} /> {workspaceName || "Workspace"}
        </Link>
        <span className="hidden text-muted lg:inline">/</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          maxLength={255}
          aria-label="Form title"
          className="min-w-0 max-w-[260px] flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] font-medium hover:border-line focus:border-violet focus:outline-none"
        />
      </div>

      <nav className="flex items-center gap-0.5 rounded-lg" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={`relative h-14 px-2.5 text-[14px] font-medium transition-colors sm:px-4 ${tab === t.id ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.id === "results" && form.response_count > 0 && (
              <span className="ml-1.5 rounded-full bg-cream-2 px-1.5 py-px text-[11px] font-semibold text-ink-2">{form.response_count}</span>
            )}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-ink" />}
          </button>
        ))}
      </nav>

      <div className="flex items-center justify-end gap-2">
        <span className="hidden items-center gap-1 text-[12px] text-muted xl:flex" title={saveError || undefined}>
          {saveState === "saving" && (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Cloud size={13} /> Saved
            </>
          )}
          {saveState === "unsaved" && <>Unsaved changes</>}
          {saveState === "error" && (
            <span className="flex items-center gap-1 text-danger">
              <AlertCircle size={13} /> Not saved
            </span>
          )}
        </span>
        <Button variant="ghost" size="sm" icon={<Eye size={16} />} onClick={onPreview} className="hidden sm:inline-flex">
          Preview
        </Button>
        {form.status === "published" ? (
          <Menu
            width={240}
            trigger={(p) => (
              <Button {...p} variant="secondary" size="sm" icon={<Check size={15} className="text-success" />}>
                Published
              </Button>
            )}
            items={[
              {
                label: "Copy link",
                icon: <Link2 size={14} />,
                onClick: () => {
                  navigator.clipboard?.writeText(publicUrl(form.slug));
                  toast.success("Link copied to clipboard");
                },
              },
              { label: "Open live form", icon: <Globe size={14} />, onClick: () => window.open(publicUrl(form.slug), "_blank") },
              { divider: true, label: "" },
              { label: "Unpublish (close the form)", danger: true, onClick: () => void onUnpublish() },
            ]}
          />
        ) : (
          <Button
            variant="accent"
            size="sm"
            loading={publishing}
            onClick={async () => {
              setPublishing(true);
              try {
                await onPublish();
              } finally {
                setPublishing(false);
              }
            }}
          >
            Publish
          </Button>
        )}
        <span className="hidden md:inline-flex">
          <Avatar size={30} />
        </span>
      </div>
    </header>
  );
}
