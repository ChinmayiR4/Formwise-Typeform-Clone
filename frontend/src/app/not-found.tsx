import Link from "next/link";
import { OrbitMark } from "@/components/art/Art";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <span className="mt-4 text-ink">
        <OrbitMark size={110} />
      </span>
      <h1 className="text-3xl font-medium text-ink">This page wandered off</h1>
      <p className="text-muted">The link may be broken, or the page may have been removed.</p>
      <Link href="/workspace" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
        Back to my forms
      </Link>
    </div>
  );
}
