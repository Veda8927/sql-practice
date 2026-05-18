"use client";

import * as React from "react";
import { Flame } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Streak = {
  correct: number;
  attempts: number;
  best: number;
  correctDurationMs: number;
  correctTimed: number;
};

const KEY = "sql-practice:streak:v1";
const EMPTY: Streak = {
  correct: 0,
  attempts: 0,
  best: 0,
  correctDurationMs: 0,
  correctTimed: 0,
};

function load(): Streak {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      correct: Number(parsed.correct) || 0,
      attempts: Number(parsed.attempts) || 0,
      best: Number(parsed.best) || 0,
      correctDurationMs: Number(parsed.correctDurationMs) || 0,
      correctTimed: Number(parsed.correctTimed) || 0,
    };
  } catch {
    return EMPTY;
  }
}

function save(s: Streak) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Imperative-style streak store via a custom event. Anywhere can dispatch
 * `streak:record` with { correct: boolean } and the badge updates.
 */
export function recordStreak(
  correct: boolean,
  meta?: { durationMs?: number; difficulty?: string },
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("streak:record", { detail: { correct, ...meta } }),
  );
}

export function resetStreak() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("streak:reset"));
}

export function StreakBadge() {
  const [s, setS] = React.useState<Streak>(EMPTY);
  const [pulse, setPulse] = React.useState(false);

  React.useEffect(() => {
    setS(load());
    const onRecord = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        correct: boolean;
        durationMs?: number;
      };
      setS((prev) => {
        const correct = prev.correct + (detail.correct ? 1 : 0);
        const attempts = prev.attempts + 1;
        const best = Math.max(prev.best, correct);
        const hasDuration =
          detail.correct && typeof detail.durationMs === "number";
        const next = {
          correct,
          attempts,
          best,
          correctDurationMs:
            prev.correctDurationMs + (hasDuration ? detail.durationMs ?? 0 : 0),
          correctTimed: prev.correctTimed + (hasDuration ? 1 : 0),
        };
        save(next);
        if (detail.correct) {
          setPulse(true);
          setTimeout(() => setPulse(false), 700);
        }
        return next;
      });
    };
    const onReset = () => {
      const next = EMPTY;
      save(next);
      setS(next);
    };
    window.addEventListener("streak:record", onRecord);
    window.addEventListener("streak:reset", onReset);
    return () => {
      window.removeEventListener("streak:record", onRecord);
      window.removeEventListener("streak:reset", onReset);
    };
  }, []);

  if (s.attempts === 0) return null;

  const pct = Math.round((s.correct / s.attempts) * 100);
  const avgMs =
    s.correctTimed > 0 ? Math.round(s.correctDurationMs / s.correctTimed) : null;
  const avgText =
    avgMs === null
      ? ""
      : ` · avg ${Math.floor(avgMs / 60000)}m ${Math.round((avgMs % 60000) / 1000)}s`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={
            "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 text-xs font-medium tabular-nums transition-transform " +
            (pulse ? "scale-110" : "")
          }
        >
          <Flame
            className={
              "h-3.5 w-3.5 " +
              (s.correct > 0
                ? "text-amber-500"
                : "text-muted-foreground")
            }
          />
          <span className="text-foreground">{s.correct}</span>
          <span className="text-muted-foreground">/ {s.attempts}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {s.correct} correct of {s.attempts} ({pct}%) · best run: {s.best}
        {avgText}
      </TooltipContent>
    </Tooltip>
  );
}
