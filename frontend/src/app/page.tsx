"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/primitives";

export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace("/workspace"), [router]);
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
