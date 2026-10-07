"use client";

import { ChevronLeft, ChevronRight, Download, Search, Sparkles, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDuration, recallLabel, timeAgo } from "@/lib/format";
import type { FormDetail, FormResponse, FormSummaryStats, Insight, Question, QuestionStats } from "@/lib/types";
import { Gauge } from "../art/Art";
import { TypeBadge } from "../builder/TypeBadge";
import { ConfirmModal } from "../ui/Modal";
import { Badge, Button, Spinner } from "../ui/primitives";
import { useToast } from "../ui/Toast";

type Sub = "summary" | "responses" | "insights";

/* ------------------------------------------------------------ summary */

function Metric({ label, value, hint, gauge }: { label: string; value: string; hint?: string; gauge?: number }) {
  return (
    <div className="flex min-w-[140px] flex-1 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)]" title={hint}>
      <div>
        <div className="text-[12px] font-medium text-muted">{label}</div>
        <div className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums">{value}</div>
      </div>
      {gauge !== undefined && <Gauge value={gauge} size={58} />}
    </div>
  );
}

/** Horizontal single-hue bar; value text stays in ink, the bar carries magnitude. */
function Bar({ label, count, percent, max }: { label: string; count: number; percent: number; max: number }) {
  return (
    <div className="group" title={`${label}: ${count} (${percent}%)`}>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="truncate text-ink-2">{label}</span>
        <span className="shrink-0 tabular-nums text-ink">
          <b>{percent}%</b> <span className="text-muted">· {count}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-2">
        <motion.div
          className="h-full rounded-full bg-violet group-hover:bg-violet-hover"
          initial={{ width: 0 }}
          animate={{ width: `${max ? (count / max) * 100 : 0}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function QuestionCard({ s, index, questions }: { s: QuestionStats; index: number; questions: Question[] }) {
  const total = s.answered + s.skipped;
  const buckets = s.choices || s.distribution?.map((d) => ({ ...d, label: `${d.value} ★` }));
  const max = buckets ? Math.max(1, ...buckets.map((b) => b.count)) : 1;
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <TypeBadge type={s.type} number={index + 1} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-snug">{s.title ? recallLabel(s.title, questions) : "Untitled question"}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            {s.answered} of {total} answered{s.skipped ? ` · ${s.skipped} skipped` : ""}
          </div>
        </div>
      </div>
      <div className="mt-4">
        {s.average !== undefined && s.average !== null && (
          <div className="mb-4 flex gap-6 text-[13px]">
            <div>
              <div className="text-muted">Average</div>
              <div className="text-[22px] font-semibold tabular-nums">{s.average}</div>
            </div>
            <div>
              <div className="text-muted">Median</div>
              <div className="text-[22px] font-semibold tabular-nums">{s.median}</div>
            </div>
            <div>
              <div className="text-muted">Range</div>
              <div className="text-[22px] font-semibold tabular-nums">
                {s.min}–{s.max}
              </div>
            </div>
          </div>
        )}
        {buckets && (
          <div className="space-y-3">
            {buckets.map((b, i) => (
              <Bar key={b.id ?? i} label={b.label ?? String(b.value)} count={b.count} percent={b.percent} max={max} />
            ))}
          </div>
        )}
        {s.latest && (
          <div className="space-y-2">
            {s.latest.length === 0 && <div className="text-[13px] text-muted">No answers yet.</div>}
            {s.latest.map((t, i) => (
              <div key={i} className="rounded-lg bg-cream px-3 py-2 text-[13.5px] text-ink-2">
                {t}
              </div>
            ))}
            {s.latest.length > 0 && <div className="text-[12px] text-muted">Latest {s.latest.length} answers</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryView({ formId, questions }: { formId: number; questions: Question[] }) {
  const [data, setData] = useState<FormSummaryStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.summary(formId).then(setData).catch((e) => setErr(e.message));
  }, [formId]);
  if (err) return <div className="text-danger">{err}</div>;
  if (!data)
    return (
      <div className="space-y-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-48" />
      </div>
    );
  const m = data.metrics;
  const maxDrop = Math.max(1, ...data.drop_off.map((d) => d.answered));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Metric label="Views" value={String(m.views)} hint={`${m.unique_views} unique visitors`} />
        <Metric label="Starts" value={String(m.starts)} hint="People who answered at least one question" />
        <Metric label="Submissions" value={String(m.submissions)} />
        <Metric label="Completion rate" value={`${m.completion_rate}%`} hint="Submissions ÷ starts" gauge={m.completion_rate} />
        <Metric label="Avg. time to complete" value={formatDuration(m.avg_duration_seconds)} />
      </div>

      {data.drop_off.length > 0 && m.starts > 0 && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="font-medium">Drop-off</div>
          <div className="mt-0.5 text-[12px] text-muted">How many people (started or finished) answered each question</div>
          <div className="mt-4 flex h-32 items-end gap-1.5">
            {data.drop_off.map((d, i) => (
              <div key={d.question_id} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Q${i + 1}: ${d.answered} answered`}>
                <span className="text-[11px] tabular-nums text-muted opacity-0 group-hover:opacity-100">{d.answered}</span>
                <motion.div
                  className="w-full max-w-[40px] rounded-t-md bg-violet/80 group-hover:bg-violet"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.answered / maxDrop) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.03 }}
                  style={{ minHeight: d.answered ? 2 : 0 }}
                />
                <span className="text-[11px] text-muted">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.questions.map((s, i) => (
          <QuestionCard key={s.question_id} s={s} index={i} questions={questions} />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- responses */

function ResponsesView({ form, onChanged }: { form: FormDetail; onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<"completed" | "in_progress">("completed");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<FormResponse | null>(null);
  const [deleting, setDeleting] = useState<FormResponse | null>(null);
  const PAGE = 25;

  const [reloadTick, setReloadTick] = useState(0);
  const key = `${status}|${query}|${page}|${reloadTick}`;
  const [loaded, setLoaded] = useState<{ key: string; data: { total: number; items: FormResponse[] } } | null>(null);
  const data = loaded?.key === key ? loaded.data : null;
  useEffect(() => {
    api
      .responses(form.id, { status, q: query, limit: PAGE, offset: page * PAGE })
      .then((d) => setLoaded({ key, data: d }))
      .catch((e) => toast.error(e.message));
  }, [form.id, status, query, page, key, toast]);
  const load = useCallback(() => setReloadTick((t) => t + 1), []);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setQuery(q);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const cols = form.questions.slice(0, 6);
  const answerOf = (r: FormResponse, qid: string) => r.answers.find((a) => a.question_id === qid)?.display ?? "";
  const openIdx = open && data ? data.items.findIndex((x) => x.id === open.id) : -1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line-2 bg-surface p-0.5 text-[13px]">
          {(["completed", "in_progress"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
              className={`rounded-md px-3 py-1.5 font-medium ${status === s ? "bg-ink text-white" : "text-ink-2 hover:bg-cream-2"}`}
            >
              {s === "completed" ? "Completed" : "Partial"}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-[260px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers" className="h-9 w-full rounded-lg border border-line-2 bg-surface pl-9 pr-3 text-sm focus:border-violet focus:outline-none" />
        </div>
        <a href={api.csvUrl(form.id)} download className="ml-auto">
          <Button variant="secondary" icon={<Download size={15} />}>
            Download CSV
          </Button>
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line bg-cream/60 text-[12px] text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{status === "completed" ? "Submitted" : "Started"}</th>
              {cols.map((c, i) => (
                <th key={c.id} className="max-w-[220px] truncate px-4 py-2.5 font-medium">
                  {i + 1}. {c.title ? recallLabel(c.title, form.questions) : "Untitled"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && (
              <tr>
                <td colSpan={cols.length + 1} className="p-8 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="p-10 text-center text-muted">
                  {query ? "No responses match your search." : status === "completed" ? "No responses yet. Share your form to start collecting them." : "No partial responses."}
                </td>
              </tr>
            )}
            {data?.items.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-b border-line last:border-0 hover:bg-violet-tint">
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{timeAgo(r.submitted_at || r.started_at)}</td>
                {cols.map((c) => (
                  <td key={c.id} className="max-w-[220px] truncate px-4 py-3">
                    {answerOf(r, c.id) || <span className="text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.total > PAGE && (
        <div className="mt-3 flex items-center justify-end gap-2 text-[13px] text-muted">
          {page * PAGE + 1}–{Math.min((page + 1) * PAGE, data.total)} of {data.total}
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* individual response drawer */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[80] bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-surface shadow-[var(--shadow-pop)]"
              role="dialog"
              aria-label="Response details"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <div>
                  <div className="font-semibold">Response #{open.id}</div>
                  <div className="text-[12px] text-muted">
                    {formatDate(open.submitted_at || open.started_at)} · {formatDuration(open.duration_seconds)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {open.status === "in_progress" && <Badge tone="warn">Partial</Badge>}
                  <button aria-label="Previous response" disabled={openIdx <= 0} onClick={() => setOpen(data!.items[openIdx - 1])} className="rounded p-1.5 hover:bg-ink/5 disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <button aria-label="Next response" disabled={!data || openIdx >= data.items.length - 1} onClick={() => setOpen(data!.items[openIdx + 1])} className="rounded p-1.5 hover:bg-ink/5 disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                  <button aria-label="Delete response" onClick={() => setDeleting(open)} className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                  <button aria-label="Close" onClick={() => setOpen(null)} className="rounded p-1.5 hover:bg-ink/5">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {form.questions.map((fq, i) => {
                  const a = open.answers.find((x) => x.question_id === fq.id);
                  return (
                    <div key={fq.id}>
                      <div className="flex items-center gap-2 text-[12.5px] text-muted">
                        <TypeBadge type={fq.type} number={i + 1} size="sm" /> {recallLabel(fq.title, form.questions)}
                      </div>
                      <div className={`mt-1.5 whitespace-pre-wrap pl-1 text-[15px] ${a ? "text-ink" : "text-muted"}`}>{a ? a.display : "Skipped"}</div>
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmModal
        open={!!deleting}
        title="Delete this response?"
        message="This response will be permanently removed from your results."
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await api.deleteResponse(form.id, deleting!.id);
            toast.success("Response deleted");
            setOpen(null);
            load();
            onChanged();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          }
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------- insights */

function InsightsView({ formId }: { formId: number }) {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      setItems((await api.insights(formId)).items);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };
  const tone: Record<string, "live" | "warn" | "violet" | "neutral"> = { positive: "live", negative: "warn", mixed: "violet", neutral: "neutral" };
  return (
    <div>
      <div className="flex flex-col items-start gap-3 rounded-xl border border-violet/25 bg-violet-tint p-5 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet text-white">
          <Sparkles size={18} />
        </span>
        <div className="flex-1">
          <div className="font-semibold">AI insights</div>
          <div className="text-[13px] text-ink-2">Summarise open-ended answers into themes and sentiment, so you don&apos;t have to read every one.</div>
        </div>
        <Button variant="accent" icon={<Sparkles size={15} />} loading={loading} onClick={run}>
          {items ? "Refresh" : "Generate insights"}
        </Button>
      </div>
      {err && <div className="mt-4 text-danger">{err}</div>}
      {items && items.length === 0 && <div className="mt-6 text-sm text-muted">This form has no long-text answers to analyse yet.</div>}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {items?.map((it) => (
          <div key={it.question_id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{it.title}</div>
              <Badge tone={tone[it.sentiment] || "neutral"}>{it.sentiment}</Badge>
            </div>
            <div className="mt-0.5 text-[12px] text-muted">
              {it.count} answers analysed · {it.source === "hf" ? "Hugging Face model" : "Offline heuristic"}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{it.summary}</p>
            {it.themes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {it.themes.map((t) => (
                  <span key={t} className="rounded-full bg-cream-2 px-2.5 py-0.5 text-[12px]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultsTab({ form, onChanged }: { form: FormDetail; onChanged: () => void }) {
  const [sub, setSub] = useState<Sub>("summary");
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-line">
        {(
          [
            ["summary", "Summary"],
            ["responses", `Responses (${form.response_count})`],
            ["insights", "Insights"],
          ] as [Sub, string][]
        ).map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} className={`relative px-3 py-2.5 text-[14px] font-medium ${sub === id ? "text-ink" : "text-muted hover:text-ink"}`}>
            {label}
            {sub === id && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ink" />}
          </button>
        ))}
      </div>
      {sub === "summary" && <SummaryView formId={form.id} questions={form.questions} />}
      {sub === "responses" && <ResponsesView form={form} onChanged={onChanged} />}
      {sub === "insights" && <InsightsView formId={form.id} />}
    </div>
  );
}
