"use client";

import { useEffect, useState } from "react";
import { FormRunner } from "@/components/respondent/FormRunner";
import { OrbitMark } from "@/components/art/Art";
import { Spinner } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/api";
import type { RunnableForm } from "@/lib/types";

/** Public form page. Served for /to/<slug> (rewrite) or /to?f=<slug>. No auth. */
function readSlug(): string | null {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "to" && parts[1]) return decodeURIComponent(parts[1]);
  return new URLSearchParams(window.location.search).get("f");
}

export default function PublicFormPage() {
  const [form, setForm] = useState<RunnableForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = readSlug();
    (slug ? api.publicForm(slug) : Promise.reject(new ApiError(400, "This link is missing the form id.")))
      .then((f) => {
        setForm(f);
        document.title = f.title;
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "This form is no longer accepting responses." : e.message));
  }, []);

  if (error)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
        <span className="text-ink">
          <OrbitMark size={110} />
        </span>
        <h1 className="text-2xl font-medium">{error}</h1>
        <p className="text-muted">If you think this is a mistake, contact the form owner.</p>
      </div>
    );
  if (!form)
    return (
      <div className="flex h-dvh items-center justify-center bg-cream">
        <Spinner size={28} />
      </div>
    );
  return <FormRunner form={form} mode="live" />;
}
