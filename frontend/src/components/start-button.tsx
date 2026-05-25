"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2 } from "lucide-react";

// The circular "send" button in the practice hero. On hover the arrow shoots
// up and a fresh one rises from below — a small send micro-interaction — with a
// springy press. Calm at rest, so the page stays minimal.
export function StartButton({
  onClick,
  loading = false,
  label,
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      whileHover={loading ? undefined : { scale: 1.08 }}
      whileTap={loading ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-95 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="relative block h-4 w-4 overflow-hidden">
          <ArrowUp className="absolute inset-0 h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-y-5" />
          <ArrowUp className="absolute inset-0 h-4 w-4 translate-y-5 transition-transform duration-300 ease-out group-hover:translate-y-0" />
        </span>
      )}
    </motion.button>
  );
}
