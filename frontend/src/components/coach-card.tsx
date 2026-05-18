"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  suggestedSql?: string | null;
  onApplySql?: (sql: string) => void;
  onDismiss?: () => void;
};

/**
 * One shared card primitive for everything the tutor surfaces — hints,
 * insights, error translations, explanations, performance reviews.
 *
 * Structure (always the same):
 *   ┌────────────────────────────────────────────────┐
 *   │ [icon]  LABEL                          [×]     │  ← header strip
 *   ├────────────────────────────────────────────────┤
 *   │ body...                                        │
 *   ├────────────────────────────────────────────────┤
 *   │ SUGGESTED FIX                       [ Apply ]  │  ← optional
 *   │ <mono code block>                              │
 *   └────────────────────────────────────────────────┘
 *
 * The icon is the only place color leaks in; the card itself is neutral.
 * That keeps the surface calm while still letting category be readable.
 */
export function CoachCard({
  label,
  icon,
  children,
  suggestedSql,
  onApplySql,
  onDismiss,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {icon}
            </span>
          )}
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
        {children}
      </div>
      {suggestedSql && onApplySql && (
        <div className="border-t border-border bg-muted/30 px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suggested fix
            </span>
            <Button
              size="sm"
              onClick={() => onApplySql(suggestedSql)}
              className="h-7 rounded-full px-3 text-xs"
            >
              Apply
            </Button>
          </div>
          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-foreground">
            {suggestedSql}
          </pre>
        </div>
      )}
    </div>
  );
}
