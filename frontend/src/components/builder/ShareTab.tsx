"use client";

import { Code2, Copy, ExternalLink, Globe, Lock, Mail, MessageSquare, PanelRight, Share2, SquareStack } from "lucide-react";
import { publicUrl } from "@/lib/format";
import type { FormDetail } from "@/lib/types";
import { Button, ComingSoon } from "../ui/primitives";
import { useToast } from "../ui/Toast";

export function ShareTab({ form, onPublish }: { form: FormDetail; onPublish: () => Promise<void> }) {
  const toast = useToast();
  const url = publicUrl(form.slug);
  const live = form.status === "published";
  const copy = () => {
    navigator.clipboard?.writeText(url);
    toast.success("Link copied to clipboard");
  };
  const enc = encodeURIComponent;
  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-8 md:px-8">
      <h1 className="text-[24px] font-semibold">Share your form</h1>
      <p className="mt-1 text-sm text-muted">Anyone with the link can fill it in — no sign-in needed.</p>

      {!live && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-[#F3D9B5] bg-[#FFF8EE] p-5 sm:flex-row sm:items-center">
          <Lock size={20} className="text-[#B25E09]" />
          <div className="flex-1">
            <div className="font-semibold">This form is a draft</div>
            <div className="text-[13px] text-ink-2">Publish it to open the link for responses.</div>
          </div>
          <Button variant="accent" onClick={onPublish}>
            Publish now
          </Button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Globe size={15} /> Share link
          {live ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F5EF] px-2 py-0.5 text-[11.5px] font-medium text-success"><span className="live-dot" /> Live</span> : null}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className={`h-10 flex-1 rounded-lg border border-line-2 bg-cream px-3 font-mono text-[13px] ${live ? "" : "opacity-60"}`} aria-label="Public link" />
          <Button variant="primary" size="lg" icon={<Copy size={15} />} onClick={copy} disabled={!live}>
            Copy link
          </Button>
          <Button variant="secondary" size="lg" icon={<ExternalLink size={15} />} disabled={!live} onClick={() => window.open(url, "_blank")}>
            Open
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className={`inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] hover:bg-cream-2 ${live ? "" : "pointer-events-none opacity-50"}`}
            href={`mailto:?subject=${enc(form.title)}&body=${enc(`I'd love your input: ${url}`)}`}
          >
            <Mail size={14} /> Email
          </a>
          <a
            className={`inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] hover:bg-cream-2 ${live ? "" : "pointer-events-none opacity-50"}`}
            href={`https://wa.me/?text=${enc(`${form.title} — ${url}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageSquare size={14} /> WhatsApp
          </a>
          <a
            className={`inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] hover:bg-cream-2 ${live ? "" : "pointer-events-none opacity-50"}`}
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Share2 size={14} /> LinkedIn
          </a>
        </div>
      </div>

      <h2 className="mt-10 text-[15px] font-semibold">Embed in a web page</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Code2, label: "Standard", desc: "Inline in your page" },
          { icon: SquareStack, label: "Popup", desc: "Opens over your page" },
          { icon: PanelRight, label: "Slider", desc: "Slides in from the side" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-dashed border-line-2 bg-surface p-4">
            <m.icon size={20} className="text-ink-2" />
            <div className="mt-3 flex items-center gap-2 font-medium">
              {m.label} <ComingSoon small />
            </div>
            <div className="mt-0.5 text-[13px] text-muted">{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
