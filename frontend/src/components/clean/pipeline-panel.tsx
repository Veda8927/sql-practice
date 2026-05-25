"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Loader2, Play, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverExpandButton } from "@/components/hover-expand-button";
import { StepEditor } from "@/components/clean/step-editor";
import type { Step } from "@/lib/clean-types";
import { cn } from "@/lib/utils";

type Props = {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  onRun: () => void;
  onFormat: () => void;
  running: boolean;
  failedIndex: number | null;
  errorMessage: string | null;
  stageRowCounts: number[]; // index-aligned with stages (0 = raw)
};

export function PipelinePanel({
  steps,
  onChange,
  onRun,
  onFormat,
  running,
  failedIndex,
  errorMessage,
  stageRowCounts,
}: Props) {
  function update(i: number, patch: Partial<Step>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const copy = [...steps];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }
  function add() {
    onChange([...steps, { title: `Step ${steps.length + 1}`, sql: "SELECT * FROM prev" }]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold">Cleaning pipeline</div>
        <div className="flex items-center gap-1.5">
          <HoverExpandButton
            label="Format"
            shortcut="⌘F"
            icon={<Wand2 className="h-3.5 w-3.5" />}
            onClick={onFormat}
            disabled={steps.length === 0}
            tone="neutral"
          />
          <HoverExpandButton
            label="Run"
            shortcut="⌘↵"
            icon={
              running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )
            }
            onClick={onRun}
            disabled={running}
            tone="success"
            alwaysOpen
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        <p className="text-xs text-muted-foreground">
          Each step is a <code className="font-mono">SELECT</code> that reads{" "}
          <code className="font-mono">prev</code> (the previous step) or{" "}
          <code className="font-mono">raw</code> (the original data).
        </p>
        {steps.map((step, i) => {
          const rowsAfter = stageRowCounts[i + 1];
          const rowsBefore = stageRowCounts[i];
          const failed = failedIndex === i;
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border bg-card p-2.5",
                failed ? "border-destructive" : "border-border",
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px]">
                  {i + 1}
                </span>
                <input
                  value={step.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                  placeholder={`Step ${i + 1}`}
                />
                {typeof rowsAfter === "number" && typeof rowsBefore === "number" && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {rowsBefore} → {rowsAfter}
                  </span>
                )}
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move step up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move step down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <StepEditor value={step.sql} onChange={(v) => update(i, { sql: v })} onRun={onRun} />
              {failed && errorMessage && (
                <div className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                  {errorMessage}
                </div>
              )}
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </div>
    </div>
  );
}
