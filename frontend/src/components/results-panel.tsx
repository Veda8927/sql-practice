"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Check,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { SolutionView } from "@/components/answer-sheet";
import { CoachCard } from "@/components/coach-card";
import { DataTable } from "@/components/data-table";
import { InsightsCard } from "@/components/insights-card";
import { computeInsights } from "@/lib/insights";
import type {
  ErrorHelpResponse,
  ExplainResponse,
  GiveUpResponse,
  GradeResult,
  PerformanceResponse,
  RunQueryResponse,
  TableResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  result: GradeResult | null;
  runResult: RunQueryResponse | null;
  expectedPreview: TableResult | null;
  explanation: ExplainResponse | null;
  explainLoading: boolean;
  onExplain: () => void;
  errorHelp: ErrorHelpResponse | null;
  errorHelpLoading: boolean;
  onErrorHelp: () => void;
  performance: PerformanceResponse | null;
  performanceLoading: boolean;
  onPerformance: () => void;
  onApplySql: (sql: string) => void;
  lastRunMs: number | null;
  orderedResults: boolean;
  solution: GiveUpResponse | null;
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
  runResult,
  expectedPreview,
  explanation,
  explainLoading,
  onExplain,
  errorHelp,
  errorHelpLoading,
  onErrorHelp,
  performance,
  performanceLoading,
  onPerformance,
  onApplySql,
  lastRunMs,
  orderedResults,
  solution,
}: Props) {
  const status = result?.status ?? "idle";
  const hasYours = result && status !== "error";
  const hasExpected = !!(result?.expected_output || expectedPreview);
  const hasSolution = !!solution;
  const showCompareToggle = hasExpected || hasSolution; // toggle whenever there's something to compare
  const showHint = (status === "wrong" || status === "error") && !explanation;

  const [view, setView] = React.useState<"yours" | "expected" | "solution">(
    "yours",
  );

  // Default view after a submit:
  React.useEffect(() => {
    if (result) setView("yours");
  }, [result]);

  // If only expected is available (no submit yet), force expected view.
  React.useEffect(() => {
    if (!hasYours && hasExpected) setView("expected");
  }, [hasYours, hasExpected]);

  // If solution disappears (new question / reset) and we're on it, fall back.
  // We do NOT auto-switch TO solution when it arrives — the user must tap it.
  React.useEffect(() => {
    if (!hasSolution && view === "solution") {
      setView(hasYours ? "yours" : hasExpected ? "expected" : "yours");
    }
  }, [hasSolution, hasYours, hasExpected, view]);

  const yoursTable = result?.user_output;
  const expectedTable = result?.expected_output ?? expectedPreview;

  // Compute Tier-2 smart-diff insights only when there's something to diff:
  // both sides exist, and the grade actually came back as wrong.
  const insights = React.useMemo(() => {
    if (status !== "wrong") return [];
    if (!yoursTable || !result?.expected_output) return [];
    return computeInsights(yoursTable, result.expected_output, orderedResults);
  }, [status, yoursTable, result, orderedResults]);
  const dbTime = result?.execution_time_ms ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <StatusDot status={status} hasPreviewOnly={!hasYours && hasExpected} />
          {lastRunMs !== null && (
            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
              {dbTime !== null ? `${dbTime} ms db` : `${lastRunMs} ms`}
            </span>
          )}
          {status === "error" && !errorHelp && (
            <button
              type="button"
              onClick={onErrorHelp}
              disabled={errorHelpLoading}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
            >
              {errorHelpLoading ? "Translating…" : "What does this mean?"}
            </button>
          )}
          {showHint && status !== "error" && (
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
        <div className="flex shrink-0 items-center gap-2">
          {yoursTable && (
            <button
              type="button"
              onClick={onPerformance}
              disabled={performanceLoading}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {performanceLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Activity className="h-3 w-3" />
              )}
              Speed
            </button>
          )}
          {showCompareToggle && (
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
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
              {hasSolution && (
                <button
                  onClick={() => setView("solution")}
                  className={cn(
                    "rounded-full px-3 py-0.5 text-xs font-medium transition-colors",
                    view === "solution"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Solution
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {errorHelp && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <CoachCard
              label="What does this mean"
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              suggestedSql={errorHelp.suggested_sql}
              onApplySql={onApplySql}
            >
              <div>{errorHelp.explanation}</div>
              <div className="mt-1 text-muted-foreground">
                {errorHelp.next_step}
              </div>
            </CoachCard>
          </motion.div>
        )}

        {explanation && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <CoachCard
              label="Why it's wrong"
              icon={<Sparkles className="h-3.5 w-3.5 text-amber-500" />}
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
            </CoachCard>
          </motion.div>
        )}

        {performance && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <CoachCard
              label="Performance"
              icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}
              suggestedSql={performance.optimized_sql}
              onApplySql={onApplySql}
            >
              {(performance.user_time_ms !== null ||
                performance.reference_time_ms !== null) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  {performance.user_time_ms !== null && (
                    <span>yours {performance.user_time_ms} ms</span>
                  )}
                  {performance.reference_time_ms !== null && (
                    <span>reference {performance.reference_time_ms} ms</span>
                  )}
                </div>
              )}
              <p>{performance.summary}</p>
              {performance.suggestions.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {performance.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Raw EXPLAIN plan
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px]">
                  {JSON.stringify(performance.raw_plan, null, 2)}
                </pre>
              </details>
            </CoachCard>
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
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Raw Postgres error
                  </div>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 font-mono text-xs text-amber-700 dark:text-amber-400">
                    {result?.error_message}
                  </pre>
                </div>
              ) : yoursTable ? (
                <>
                  <InsightsCard insights={insights} />
                  <DataTable
                    columns={yoursTable.columns}
                    rows={yoursTable.rows}
                  />
                </>
              ) : runResult?.status === "error" ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Raw Postgres error
                  </div>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 font-mono text-xs text-amber-700 dark:text-amber-400">
                    {runResult.error_message}
                  </pre>
                </div>
              ) : runResult?.output ? (
                <DataTable
                  columns={runResult.output.columns}
                  rows={runResult.output.rows as unknown[][]}
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
            {view === "solution" && solution && (
              <SolutionView solution={solution} onApplyToEditor={onApplySql} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
