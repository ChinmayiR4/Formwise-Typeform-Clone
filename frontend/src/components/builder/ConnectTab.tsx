"use client";

import { Bell, Database, FileSpreadsheet, Hash, Mail, NotebookTabs, Webhook, Zap } from "lucide-react";
import { ComingSoon } from "../ui/primitives";

const ITEMS = [
  { icon: FileSpreadsheet, name: "Spreadsheets", desc: "Send every new response to a sheet as a row." },
  { icon: Hash, name: "Team chat", desc: "Post a message to a channel when someone submits." },
  { icon: Mail, name: "Email notifications", desc: "Get an email for each new response." },
  { icon: Database, name: "CRM", desc: "Create or update contacts from answers." },
  { icon: NotebookTabs, name: "Docs & wikis", desc: "Append responses to a database page." },
  { icon: Zap, name: "Automation platforms", desc: "Connect to thousands of apps without code." },
];

export function ConnectTab() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-8 md:px-8">
      <h1 className="text-[24px] font-semibold">Connect</h1>
      <p className="mt-1 text-sm text-muted">Send your responses to the tools you already use.</p>

      <div className="mt-6 rounded-xl border border-violet/25 bg-violet-tint p-5">
        <div className="flex items-center gap-2 font-semibold">
          <Webhook size={18} className="text-violet" /> Webhooks <ComingSoon />
        </div>
        <p className="mt-1 text-[13px] text-ink-2">POST each submission as JSON to your own endpoint, signed with a secret.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input disabled placeholder="https://example.com/webhooks/forms" className="h-9 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-sm opacity-60" />
          <button disabled className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-white opacity-40">
            Add webhook
          </button>
        </div>
      </div>

      <h2 className="mt-8 text-[15px] font-semibold">Integrations</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => (
          <div key={it.name} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream-2">
                <it.icon size={18} />
              </span>
              <ComingSoon small />
            </div>
            <div className="mt-3 font-medium">{it.name}</div>
            <div className="mt-0.5 text-[13px] text-muted">{it.desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 text-[13px] text-muted">
        <Bell size={14} /> We&apos;ll let you know when integrations go live.
      </div>
    </div>
  );
}
