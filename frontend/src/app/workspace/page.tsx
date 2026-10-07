"use client";

import {
  BarChart3,
  Copy,
  ExternalLink,
  FolderInput,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Globe,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { OrbitMark } from "@/components/art/Art";
import { CreateFormModal } from "@/components/workspace/CreateFormModal";
import { ConfirmModal, PromptModal } from "@/components/ui/Modal";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { Badge, Button, ComingSoon, IconButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { publicUrl, timeAgo } from "@/lib/format";
import { resolveTheme } from "@/lib/theme";
import type { FormSummary, Workspace } from "@/lib/types";

type Sort = "updated" | "created" | "title";

/** Miniature of the form's first screen, painted with its theme colours. */
function FormThumb({ form, large }: { form: FormSummary; large?: boolean }) {
  const t = resolveTheme(form.theme);
  return (
    <div
      className={`flex shrink-0 flex-col justify-center overflow-hidden rounded-lg border border-black/5 ${large ? "h-32 w-full gap-2 px-5" : "h-10 w-10 gap-[3px] px-[7px]"}`}
      style={{ background: t.background }}
      aria-hidden
    >
      <span className={`rounded-full ${large ? "h-2.5 w-3/4" : "h-[3px] w-full"}`} style={{ background: t.question_color, opacity: 0.85 }} />
      <span className={`rounded-full ${large ? "h-2.5 w-1/2" : "h-[3px] w-2/3"}`} style={{ background: t.question_color, opacity: 0.35 }} />
      <span className={`rounded ${large ? "mt-2 h-5 w-14" : "mt-[2px] h-[6px] w-[12px]"}`} style={{ background: t.button_color }} />
    </div>
  );
}

function WorkspaceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  // forms are tagged with the workspace + sort they were loaded for; a mismatch means "loading"
  const [loaded, setLoaded] = useState<{ key: string; items: FormSummary[] } | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<"list" | "grid">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<FormSummary | null>(null);
  const [deleting, setDeleting] = useState<FormSummary | null>(null);
  const [wsModal, setWsModal] = useState<"new" | "rename" | null>(null);
  const [wsDeleting, setWsDeleting] = useState(false);

  const wsId = Number(params.get("ws")) || workspaces?.[0]?.id;
  const ws = workspaces?.find((w) => w.id === wsId);

  // remember grid/list preference per browser
  useEffect(() => {
    try {
      const v = localStorage.getItem("fw_view");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after hydration
      if (v === "grid" || v === "list") setView(v);
    } catch {}
  }, []);
  const changeView = (v: "list" | "grid") => {
    setView(v);
    try {
      localStorage.setItem("fw_view", v);
    } catch {}
  };

  const loadWorkspaces = useCallback(() => api.workspaces().then(setWorkspaces).catch((e) => toast.error(e.message)), [toast]);
  const formsKey = `${wsId}:${sort}`;
  const loadForms = useCallback(() => {
    if (!wsId) return;
    api
      .forms({ workspace_id: wsId, sort })
      .then((items) => setLoaded({ key: `${wsId}:${sort}`, items }))
      .catch((e) => toast.error(e.message));
  }, [wsId, sort, toast]);
  const forms = loaded && loaded.key === formsKey ? loaded.items : null;

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);
  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const visible = useMemo(() => (forms || []).filter((f) => f.title.toLowerCase().includes(q.toLowerCase())), [forms, q]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      loadForms();
      loadWorkspaces();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    }
  };

  const menuFor = (f: FormSummary): MenuItem[] => [
    { label: "Open", icon: <Pencil size={14} />, onClick: () => router.push(`/form?id=${f.id}`) },
    { label: "Results", icon: <BarChart3 size={14} />, onClick: () => router.push(`/form?id=${f.id}&tab=results`) },
    {
      label: "Copy link",
      icon: <Link2 size={14} />,
      disabled: f.status !== "published",
      onClick: () => {
        navigator.clipboard?.writeText(publicUrl(f.slug));
        toast.success("Link copied to clipboard");
      },
    },
    { label: "View live form", icon: <ExternalLink size={14} />, disabled: f.status !== "published", onClick: () => window.open(publicUrl(f.slug), "_blank") },
    { divider: true, label: "" },
    { label: "Rename", icon: <Pencil size={14} />, onClick: () => setRenaming(f) },
    { label: "Duplicate", icon: <Copy size={14} />, onClick: () => act(() => api.duplicateForm(f.id), `Duplicated “${f.title}”`) },
    f.status === "published"
      ? { label: "Unpublish", icon: <EyeOff size={14} />, onClick: () => act(() => api.unpublish(f.id), "Form unpublished — the link is now closed") }
      : { label: "Publish", icon: <Globe size={14} />, onClick: () => act(() => api.publish(f.id), "Form published 🎉") },
    ...((workspaces || [])
      .filter((w) => w.id !== f.workspace_id)
      .slice(0, 4)
      .map((w) => ({
        label: `Move to ${w.name}`,
        icon: <FolderInput size={14} />,
        onClick: () => act(() => api.updateForm(f.id, { workspace_id: w.id }), `Moved to ${w.name}`),
      })) as MenuItem[]),
    { divider: true, label: "" },
    { label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleting(f) },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1">
        {/* sidebar */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
          <Button variant="primary" size="lg" icon={<Plus size={18} />} className="w-full" onClick={() => setCreateOpen(true)}>
            Create a new form
          </Button>
          <div className="mt-6 flex items-center justify-between px-2 section-label">
            Workspaces
            <IconButton label="New workspace" className="h-6 w-6" onClick={() => setWsModal("new")}>
              <Plus size={14} />
            </IconButton>
          </div>
          <nav className="mt-1 flex flex-col gap-0.5">
            {!workspaces && [0, 1].map((i) => <div key={i} className="skeleton mx-2 my-1 h-7" />)}
            {workspaces?.map((w) => (
              <Link
                key={w.id}
                href={`/workspace?ws=${w.id}`}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-[14px] ${
                  w.id === wsId ? "bg-violet-soft font-semibold text-violet" : "text-ink-2 hover:bg-cream-2"
                }`}
              >
                <span className="truncate">{w.name}</span>
                <span className="text-[12px] opacity-70">{w.form_count}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-6 px-2 section-label">Shared</div>
          <div className="mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-[14px] text-muted">
            <span className="flex items-center gap-2">
              <Users size={14} /> Shared with me
            </span>
            <ComingSoon small />
          </div>
          <div className="mt-auto rounded-xl border border-line bg-cream/60 p-4 text-[13px]">
            <div className="flex -space-x-2">
              {["AC", "PR", "JK"].map((i, k) => (
                <span
                  key={i}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-[10px] font-semibold text-white"
                  style={{ background: ["#2f54eb", "#111318", "#6b7080"][k] }}
                >
                  {i}
                </span>
              ))}
            </div>
            <div className="mt-3 font-semibold">Invite your team</div>
            <p className="mt-0.5 text-muted">Build and review forms together.</p>
            <div className="mt-2">
              <ComingSoon small />
            </div>
          </div>
        </aside>

        {/* main */}
        <main className="relative min-w-0 flex-1 px-4 py-6 md:px-10">
          <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="display text-[34px] leading-none text-ink">{ws?.name ?? " "}</h1>
              {ws && (
                <Menu
                  align="left"
                  trigger={(p) => (
                    <IconButton {...p} label="Workspace options">
                      <MoreHorizontal size={18} />
                    </IconButton>
                  )}
                  items={[
                    { label: "Rename workspace", icon: <Pencil size={14} />, onClick: () => setWsModal("rename") },
                    { label: "Delete workspace", icon: <Trash2 size={14} />, danger: true, onClick: () => setWsDeleting(true) },
                  ]}
                />
              )}
            </div>
            <Button variant="primary" icon={<Plus size={16} />} className="md:hidden" onClick={() => setCreateOpen(true)}>
              New form
            </Button>
          </div>

          {/* overview: headline numbers for this workspace + the signature orbit mark */}
          <section className="relative mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            <div
              className="pointer-events-none absolute inset-0 dot-grid"
              style={{ maskImage: "linear-gradient(to left, black, transparent 55%)", WebkitMaskImage: "linear-gradient(to left, black, transparent 55%)" }}
              aria-hidden
            />
            <div className="relative flex items-center gap-6 px-6 py-5">
              <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                {[
                  { label: "Forms", value: forms?.length },
                  { label: "Live", value: forms?.filter((f) => f.status === "published").length, live: true },
                  { label: "Responses", value: forms?.reduce((n, f) => n + f.response_count, 0) },
                  { label: "Questions", value: forms?.reduce((n, f) => n + f.question_count, 0) },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
                      {m.live && <span className="live-dot" />}
                      {m.label}
                    </div>
                    <div className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
                      {m.value ?? <span className="skeleton inline-block h-6 w-10 align-middle" />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden shrink-0 text-ink md:block">
                <OrbitMark size={104} />
              </div>
            </div>
          </section>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-[280px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search forms"
                className="h-9 w-full rounded-lg border border-line-2 bg-surface pl-9 pr-3 text-sm focus:border-violet focus:outline-none"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-9 rounded-lg border border-line-2 bg-surface px-2 text-sm"
                aria-label="Sort forms"
              >
                <option value="updated">Last updated</option>
                <option value="created">Date created</option>
                <option value="title">Alphabetical</option>
              </select>
              <div className="flex rounded-lg border border-line-2 bg-surface p-0.5">
                <IconButton label="List view" className={`h-7 w-7 ${view === "list" ? "bg-cream-2" : ""}`} onClick={() => changeView("list")}>
                  <List size={15} />
                </IconButton>
                <IconButton label="Grid view" className={`h-7 w-7 ${view === "grid" ? "bg-cream-2" : ""}`} onClick={() => changeView("grid")}>
                  <LayoutGrid size={15} />
                </IconButton>
              </div>
            </div>
          </div>

          {/* loading */}
          {!forms && (
            <div className="mt-6 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16" />
              ))}
            </div>
          )}

          {/* empty */}
          {forms && visible.length === 0 && (
            <div className="mt-16 flex flex-col items-center text-center">
              <div className="text-ink">
                <OrbitMark size={120} />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{q ? "No forms match your search" : "No forms here yet"}</h2>
              <p className="mt-1 max-w-sm text-sm text-muted">
                {q ? "Try a different search term." : "Create your first form — start from scratch or let AI draft it for you."}
              </p>
              {!q && (
                <Button variant="primary" className="mt-5" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
                  Create a new form
                </Button>
              )}
            </div>
          )}

          {/* list view */}
          {forms && visible.length > 0 && view === "list" && (
            <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
              <div className="hidden grid-cols-[1fr_120px_110px_140px_44px] items-center gap-4 border-b border-line px-4 py-2.5 section-label md:grid">
                <span>Form</span>
                <span>Responses</span>
                <span>Status</span>
                <span>Updated</span>
                <span />
              </div>
              {visible.map((f) => (
                <div
                  key={f.id}
                  onClick={() => router.push(`/form?id=${f.id}`)}
                  className="group grid cursor-pointer grid-cols-[1fr_44px] items-center gap-4 border-b border-line px-4 py-3 last:border-0 hover:bg-cream/60 md:grid-cols-[1fr_120px_110px_140px_44px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FormThumb form={f} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.title}</div>
                      <div className="text-[12px] text-muted md:hidden">
                        {f.response_count} responses · {f.status === "published" ? "Live" : "Draft"}
                      </div>
                      <div className="hidden text-[12px] text-muted md:block">{f.question_count} questions</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/form?id=${f.id}&tab=results`);
                    }}
                    className="hidden text-left text-[14px] hover:text-violet md:block"
                  >
                    {f.response_count > 0 ? <b>{f.response_count}</b> : <span className="text-muted">—</span>}
                  </button>
                  <span className="hidden md:block">
                    {f.status === "published" ? <Badge tone="live"><span className="live-dot" /> Live</Badge> : <Badge>Draft</Badge>}
                  </span>
                  <span className="hidden text-[13px] text-muted md:block">{timeAgo(f.updated_at)}</span>
                  <Menu
                    trigger={(p) => (
                      <IconButton {...p} label="Form options" className="opacity-60 group-hover:opacity-100">
                        <MoreHorizontal size={18} />
                      </IconButton>
                    )}
                    items={menuFor(f)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* grid view */}
          {forms && visible.length > 0 && view === "grid" && (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <button
                onClick={() => setCreateOpen(true)}
                className="flex min-h-[214px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-2 text-muted hover:border-violet hover:text-violet"
              >
                <Plus size={26} />
                <span className="mt-2 text-sm font-medium">New form</span>
              </button>
              {visible.map((f) => (
                <div
                  key={f.id}
                  onClick={() => router.push(`/form?id=${f.id}`)}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
                >
                  <FormThumb form={f} large />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                        {f.status === "published" ? <Badge tone="live"><span className="live-dot" /> Live</Badge> : <Badge>Draft</Badge>}
                        {f.response_count} responses
                      </div>
                    </div>
                    <Menu
                      trigger={(p) => (
                        <IconButton {...p} label="Form options">
                          <MoreHorizontal size={18} />
                        </IconButton>
                      )}
                      items={menuFor(f)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </main>
      </div>

      <CreateFormModal open={createOpen} onClose={() => setCreateOpen(false)} workspaceId={wsId} />
      <PromptModal
        open={!!renaming}
        title="Rename form"
        label="Form name"
        initial={renaming?.title}
        onClose={() => setRenaming(null)}
        onSubmit={(title) => act(() => api.updateForm(renaming!.id, { title }), "Form renamed")}
      />
      <ConfirmModal
        open={!!deleting}
        title="Delete this form?"
        message={
          <>
            <b>{deleting?.title}</b> and all of its <b>{deleting?.response_count} responses</b> will be permanently deleted. This can&apos;t be undone.
          </>
        }
        onClose={() => setDeleting(null)}
        onConfirm={() => act(() => api.deleteForm(deleting!.id), "Form deleted")}
      />
      <PromptModal
        open={wsModal !== null}
        title={wsModal === "new" ? "Create a workspace" : "Rename workspace"}
        label="Workspace name"
        initial={wsModal === "rename" ? ws?.name : ""}
        confirmLabel={wsModal === "new" ? "Create" : "Save"}
        onClose={() => setWsModal(null)}
        onSubmit={async (name) => {
          try {
            if (wsModal === "new") {
              const w = await api.createWorkspace(name);
              router.push(`/workspace?ws=${w.id}`);
              toast.success("Workspace created");
            } else if (ws) {
              await api.renameWorkspace(ws.id, name);
              toast.success("Workspace renamed");
            }
            loadWorkspaces();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          }
        }}
      />
      <ConfirmModal
        open={wsDeleting}
        title="Delete workspace?"
        message={
          <>
            <b>{ws?.name}</b> and all {ws?.form_count} forms inside it will be permanently deleted.
          </>
        }
        onClose={() => setWsDeleting(false)}
        onConfirm={async () => {
          try {
            await api.deleteWorkspace(ws!.id);
            toast.success("Workspace deleted");
            router.push("/workspace");
            loadWorkspaces();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          }
        }}
      />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceInner />
    </Suspense>
  );
}
