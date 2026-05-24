"use client";

import type { PyQuestion } from "@/lib/python-types";

const DIFF_TONE: Record<string, string> = {
  easy: "text-emerald-600",
  medium: "text-amber-600",
  hard: "text-destructive",
};

export function PyPrompt({ question }: { question: PyQuestion }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5">{question.concept}</span>
        <span className={DIFF_TONE[question.difficulty] ?? ""}>{question.difficulty}</span>
        <span>· {question.test_count} tests</span>
        {question.entrypoint && (
          <span className="font-mono text-foreground/70">def {question.entrypoint}(…)</span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground/90">{question.prompt}</p>
    </div>
  );
}
