"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
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
  language?: "sql" | "python";
};

// Derive a short, human label from a step's SQL so collapsed steps read like
// "Filter rows" / "Deduplicate" instead of "Step 3". Order matters: more
// specific cleaning ops win over the generic SELECT.
function deriveStepName(code: string, language: "sql" | "python"): string | null {
  const s = code.toLowerCase();
  if (language === "python") {
    if (/drop_duplicates/.test(s)) return "Deduplicate";
    if (/(strip|lower|upper|title|\.str\.|regexp|\.replace)/.test(s)) return "Normalize text";
    if (/fillna|dropna|isna|notna/.test(s)) return "Handle nulls";
    if (/astype|to_datetime|to_numeric/.test(s)) return "Cast types";
    if (/groupby|\.agg\b/.test(s)) return "Aggregate";
    if (/query\(|\.loc\[|prev\[/.test(s)) return "Filter rows";
    if (/sort_values/.test(s)) return "Sort";
    if (/merge|\.join/.test(s)) return "Join";
    return null;
  }
  if (/\bdistinct\b/.test(s)) return "Deduplicate";
  if (/\bgroup\s+by\b/.test(s)) return "Aggregate";
  if (/\b(btrim|trim|lower|upper|initcap)\s*\(/.test(s)) return "Normalize text";
  if (/\bcoalesce\s*\(/.test(s) || /\bis\s+null\b/.test(s)) return "Handle nulls";
  if (/\b(regexp_replace|replace)\s*\(/.test(s)) return "Replace values";
  if (/(::|\bcast\s*\()/.test(s)) return "Cast types";
  if (/\bwhere\b/.test(s)) return "Filter rows";
  if (/\border\s+by\b/.test(s)) return "Sort";
  if (/\bjoin\b/.test(s)) return "Join";
  if (/\bselect\b/.test(s)) return "Select columns";
  return null;
}

// Prefer a name the user typed; otherwise fall back to the derived label.
function displayName(step: Step, i: number, language: "sql" | "python"): string {
  const custom = step.title?.trim();
  const isDefault = !custom || /^step\s+\d+$/i.test(custom);
  if (!isDefault) return custom!;
  return deriveStepName(step.sql, language) ?? `Step ${i + 1}`;
}

export function PipelinePanel({
  steps,
  onChange,
  onRun,
  onFormat,
  running,
  failedIndex,
  errorMessage,
  stageRowCounts,
  language = "sql",
}: Props) {
  // Accordion: at most one step expanded. Default to the last step so a
  // restored pipeline opens on its most recent step.
  const [expanded, setExpanded] = React.useState<number | null>(
    steps.length ? steps.length - 1 : null,
  );

  function update(i: number, patch: Partial<Step>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
    setExpanded((cur) => {
      if (cur === null) return null;
      if (cur === i) return null;
      return cur > i ? cur - 1 : cur;
    });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const copy = [...steps];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
    // Keep the expanded step pinned to the one the user is moving.
    setExpanded((cur) => (cur === i ? j : cur === j ? i : cur));
  }
  function add() {
    const sql = language === "python" ? "prev = prev" : "SELECT * FROM prev";
    onChange([...steps, { title: `Step ${steps.length + 1}`, sql }]);
    setExpanded(steps.length); // expand the new step, collapsing the rest
  }
  function toggle(i: number) {
    setExpanded((cur) => (cur === i ? null : i));
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

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-4">
        {steps.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
            <p className="text-sm font-medium">Build a cleaning pipeline</p>
            {language === "python" ? (
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Each step is pandas code that assigns a DataFrame to{" "}
                <code className="font-mono">prev</code> (e.g.{" "}
                <code className="font-mono">prev = prev.drop_duplicates()</code>).{" "}
                <code className="font-mono">raw</code> is the original.
              </p>
            ) : (
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Each step is a <code className="font-mono">SELECT</code> reading{" "}
                <code className="font-mono">prev</code> (previous step) or{" "}
                <code className="font-mono">raw</code> (original data).
              </p>
            )}
          </div>
        )}
        {steps.map((step, i) => {
          const rowsAfter = stageRowCounts[i + 1];
          const rowsBefore = stageRowCounts[i];
          const failed = failedIndex === i;
          const isOpen = expanded === i;
          const rowCounts =
            typeof rowsAfter === "number" && typeof rowsBefore === "number" ? (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {rowsBefore} → {rowsAfter}
              </span>
            ) : null;

          return (
            <div
              key={i}
              className={cn(
                "group rounded-lg border bg-card transition-colors",
                failed ? "border-destructive" : "border-border hover:border-border/80",
              )}
            >
              {/* Header row — click to expand/collapse */}
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px]">
                    {i + 1}
                  </span>
                  {isOpen ? (
                    <input
                      value={step.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                      placeholder={deriveStepName(step.sql, language) ?? `Step ${i + 1}`}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {displayName(step, i, language)}
                    </span>
                  )}
                </button>
                {rowCounts}
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label="Move step up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label="Move step down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-2.5 pb-2.5">
                  <StepEditor
                    value={step.sql}
                    onChange={(v) => update(i, { sql: v })}
                    onRun={onRun}
                    language={language}
                  />
                  {failed && errorMessage && (
                    <div className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                      {errorMessage}
                    </div>
                  )}
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
