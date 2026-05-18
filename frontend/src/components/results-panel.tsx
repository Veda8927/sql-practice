"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";

import { DataTable } from "@/components/data-table";
import type { ExplainResponse, GradeResult, TableResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  result: GradeResult | null;
  expectedPreview: TableResult | null;
  explanation: ExplainResponse | null;
  explainLoading: boolean;
  onExplain: () => void;
  lastRunMs: number | null;
};

function StatusDot({
  status,
  hasPreviewOnly,
}: {
  status: GradeResult["status"] | "idle";
  hasPreviewOnly: boolean;
}) {
  const className = cn(
    "inline-flex items-center gap-2 text-xs font-medium",
    status === "correct" && "text-emerald-600 dark:text-emerald-400",
    status === "wrong" && "text-rose-600 dark:text-rose-400",
    status === "error" && "text-amber-600 dark:text-amber-400",
    status === "idle" && "text-muted-foreground",
  );

  const label = {
    correct: "Correct",
    wrong: "Doesn't match",
    error: "Error",
    idle: hasPreviewOnly ? "Result" : "Result",
  }[status];

  const Icon = status === "correct" ? Check : status === "wrong" ? X : null;

  return (
    <span className={className}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {!Icon && status !== "idle" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

export function ResultsPanel({
  result,
  expectedPreview,
  explanation,
  explainLoading,
  onExplain,
  lastRunMs,
}: Props) {
  const status = result?.status ?? "idle";
  const hasYours = result && status !== "error";
  const hasExpected = !!(result?.expected_output || expectedPreview);
  const showCompareToggle = hasExpected; // toggle is on whenever expected exists
  const showHint = (status === "wrong" || status === "error") && !explanation;

  const [view, setView] = React.useState<"yours" | "expected">("yours");

  // Default view after a submit:
  React.useEffect(() => {
    if (result) setView("yours");
  }, [result]);

  // If only expected is available (no submit yet), force expected view.
  React.useEffect(() => {
    if (!hasYours && hasExpected) setView("expected");
  }, [hasYours, hasExpected]);

  const yoursTable = result?.user_output;
  const expectedTable = result?.expected_output ?? expectedPreview;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <StatusDot status={status} hasPreviewOnly={!hasYours && hasExpected} />
          {lastRunMs !== null && (
            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
              {lastRunMs} ms
            </span>
          )}
          {showHint && (
            <button
              type="button"
              onClick={onExplain}
              disabled={explainLoading}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
            >
              {explainLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking…
                </span>
              ) : (
                "Get a hint"
              )}
            </button>
          )}
        </div>
        {showCompareToggle && (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setView("yours")}
              className={cn(
                "rounded-full px-3 py-0.5 text-xs font-medium transition-colors",
                view === "yours"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Yours
            </button>
            <button
              onClick={() => setView("expected")}
              className={cn(
                "rounded-full px-3 py-0.5 text-xs font-medium transition-colors",
                view === "expected"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Expected
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {explanation && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground"
          >
            {explanation.typo_corrections.length > 0 && (
              <div className="mb-2 font-mono text-xs">
                {explanation.typo_corrections.map((t, i) => (
                  <div key={i}>
                    <span className="text-rose-600 dark:text-rose-400">
                      {t.wrong}
                    </span>
                    {" → "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t.right}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {explanation.explanation}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {view === "yours" &&
              (status === "error" ? (
                <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 font-mono text-xs text-amber-700 dark:text-amber-400">
                  {result?.error_message}
                </pre>
              ) : yoursTable ? (
                <DataTable
                  columns={yoursTable.columns}
                  rows={yoursTable.rows}
                />
              ) : (
                <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
                  Run your query to see your result.
                </div>
              ))}
            {view === "expected" &&
              (expectedTable ? (
                <DataTable
                  columns={expectedTable.columns}
                  rows={expectedTable.rows}
                />
              ) : (
                <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
                  The expected output will appear once a question is loaded.
                </div>
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
