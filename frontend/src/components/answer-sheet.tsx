"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Copy,
  Check,
  Database,
  Filter as FilterIcon,
  GitBranch,
  Layers,
  ListOrdered,
  Scissors,
  SquareStack,
  Table as TableIcon,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { format as formatSql } from "sql-formatter";

import { Button } from "@/components/ui/button";
import type { GiveUpResponse } from "@/lib/types";

type Props = {
  solution: GiveUpResponse;
  onApplyToEditor?: (sql: string) => void;
};

type PipelineStep = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

function pipelineStepsFromSql(sql: string): PipelineStep[] {
  const s = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const steps: PipelineStep[] = [];

  // Always start with the source.
  steps.push({
    key: "from",
    label: "Read tables",
    icon: <Database className="h-3.5 w-3.5" />,
  });

  if (/\bWITH\s+\w+\s+AS\s*\(/i.test(s)) {
    steps.unshift({
      key: "cte",
      label: "Build CTE",
      icon: <Layers className="h-3.5 w-3.5" />,
    });
  }
  if (/\bJOIN\b/i.test(s)) {
    steps.push({
      key: "join",
      label: "Join tables",
      icon: <GitBranch className="h-3.5 w-3.5" />,
    });
  }
  if (/\bWHERE\b/i.test(s)) {
    steps.push({
      key: "where",
      label: "Filter rows",
      icon: <FilterIcon className="h-3.5 w-3.5" />,
    });
  }
  if (/\bGROUP\s+BY\b/i.test(s)) {
    steps.push({
      key: "group",
      label: "Group",
      icon: <SquareStack className="h-3.5 w-3.5" />,
    });
  }
  if (/\bHAVING\b/i.test(s)) {
    steps.push({
      key: "having",
      label: "Filter groups",
      icon: <FilterIcon className="h-3.5 w-3.5" />,
    });
  }
  if (/\bOVER\s*\(/i.test(s)) {
    steps.push({
      key: "window",
      label: "Window math",
      icon: <Layers className="h-3.5 w-3.5" />,
    });
  }
  steps.push({
    key: "select",
    label: "Pick columns",
    icon: <TableIcon className="h-3.5 w-3.5" />,
  });
  if (/\bORDER\s+BY\b/i.test(s)) {
    steps.push({
      key: "order",
      label: "Sort",
      icon: <ListOrdered className="h-3.5 w-3.5" />,
    });
  }
  if (/\bLIMIT\b/i.test(s)) {
    steps.push({
      key: "limit",
      label: "Take top N",
      icon: <Scissors className="h-3.5 w-3.5" />,
    });
  }

  return steps;
}

function SqlPipeline({ sql }: { sql: string }) {
  const steps = React.useMemo(() => pipelineStepsFromSql(sql), [sql]);
  if (steps.length <= 1) return null;
  return (
    <section>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        How the SQL flows
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max items-center gap-1.5">
          {steps.map((step, i) => (
            <React.Fragment key={step.key}>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i, duration: 0.22 }}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5"
              >
                <span className="text-muted-foreground">{step.icon}</span>
                <span className="text-[11px] font-medium text-foreground">
                  {step.label}
                </span>
              </motion.div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SolutionView({ solution, onApplyToEditor }: Props) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "light" ? "vs" : "vs-dark";
  const [copied, setCopied] = React.useState(false);

  const formatted = React.useMemo(() => {
    try {
      return formatSql(solution.reference_sql, {
        language: "postgresql",
        keywordCase: "upper",
        tabWidth: 2,
      });
    } catch {
      return solution.reference_sql;
    }
  }, [solution]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const breakdown = solution.breakdown ?? [];

  return (
    <div className="space-y-6">
      {solution.summary && (
        <p className="text-[15px] leading-relaxed text-foreground">
          {solution.summary}
        </p>
      )}

      {breakdown.length > 0 && (
        <section>
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Breaking the question apart
          </div>
          <ul className="space-y-2.5">
            {breakdown.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * (i + 1) }}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2.5"
              >
                <div className="text-[13px] font-medium italic text-foreground/90">
                  &ldquo;{item.phrase}&rdquo;
                </div>
                <div className="mt-1 flex gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  <span className="shrink-0 text-foreground/40">→</span>
                  <span>{item.means}</span>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {solution.approach && (
        <section>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            The plan
          </div>
          <p className="text-[14px] leading-relaxed text-foreground/90">
            {solution.approach}
          </p>
        </section>
      )}

      <SqlPipeline sql={solution.reference_sql} />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Reference SQL
          </div>
          <div className="flex items-center gap-1">
            {onApplyToEditor && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onApplyToEditor(formatted)}
                className="h-7 rounded-full px-2 text-xs"
              >
                Paste into editor
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-7 gap-1 rounded-full px-2 text-xs"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <Editor
            height={Math.min(
              280,
              Math.max(120, formatted.split("\n").length * 22 + 28),
            )}
            defaultLanguage="sql"
            language="sql"
            theme={monacoTheme}
            value={formatted}
            options={{
              readOnly: true,
              fontSize: 13,
              fontFamily:
                "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbersMinChars: 2,
              padding: { top: 10, bottom: 10 },
              renderLineHighlight: "none",
              scrollbar: { vertical: "hidden", horizontal: "auto" },
            }}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          How it works, step by step
        </div>
        <ol className="space-y-6">
          {solution.steps.map((step, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * (i + 1) }}
            >
              <div className="flex items-baseline gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-[11px] font-semibold tabular-nums text-foreground">
                  {i + 1}
                </span>
                <h3 className="text-[14px] font-semibold text-foreground">
                  {step.title.replace(/^step\s*\d+:\s*/i, "")}
                </h3>
              </div>
              <div className="mt-2 space-y-3 pl-9">
                <p className="text-[14px] leading-relaxed text-foreground/90">
                  {step.what_it_does}
                </p>
                {step.sql_snippet && (
                  <pre className="overflow-auto rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground">
                    {step.sql_snippet}
                  </pre>
                )}
                {step.how_postgres_reads_it && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      What the database does:{" "}
                    </span>
                    {step.how_postgres_reads_it}
                  </p>
                )}
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      {solution.final_thought && (
        <section className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-[14px] leading-relaxed text-foreground">
            {solution.final_thought}
          </p>
        </section>
      )}
    </div>
  );
}
