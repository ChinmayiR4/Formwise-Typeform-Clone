"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { onSlowRequest } from "@/lib/api";
import { Spinner } from "./ui/primitives";

/** Free-tier backends sleep when idle; explain the delay instead of looking broken. */
export function SlowServerNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequest(setSlow), []);
  return (
    <AnimatePresence>
      {slow && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed left-1/2 top-3 z-[99] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] text-white shadow-[var(--shadow-pop)]"
        >
          <Spinner size={14} className="!text-white" />
          Waking up the server… this can take up to a minute on the free tier.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
