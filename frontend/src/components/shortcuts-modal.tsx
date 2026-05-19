"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Shortcut = { keys: string[]; label: string };

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Editor",
    items: [
      { keys: ["⌘", "F"], label: "Format SQL" },
      { keys: ["⌘", "R"], label: "Run (free run, no grading)" },
      { keys: ["⌘", "S"], label: "Submit (grade against expected)" },
      { keys: ["⌘", "."], label: "Show quick fix on a SQL typo" },
    ],
  },
  {
    group: "Practice",
    items: [
      { keys: ["⌘", "N"], label: "Next question" },
      { keys: ["?"], label: "Open this shortcuts panel" },
      { keys: ["Esc"], label: "Close any open dialog" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsModal({ open, onClose }: Props) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="space-y-5 p-5">
              {SHORTCUTS.map((group) => (
                <section key={group.group}>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.group}
                  </h3>
                  <ul className="space-y-1.5">
                    {group.items.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-foreground">
                          {s.label}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {s.keys.map((k, j) => (
                            <React.Fragment key={j}>
                              <Kbd>{k}</Kbd>
                              {j < s.keys.length - 1 && (
                                <span className="text-muted-foreground">
                                  +
                                </span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
