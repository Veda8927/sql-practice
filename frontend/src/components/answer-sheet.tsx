"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, X } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { format as formatSql } from "sql-formatter";

import { Button } from "@/components/ui/button";
import type { GiveUpResponse } from "@/lib/types";

type Props = {
  solution: GiveUpResponse | null;
  onClose: () => void;
  onApplyToEditor?: (sql: string) => void;
};

export function AnswerSheet({ solution, onClose, onApplyToEditor }: Props) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "light" ? "vs" : "vs-dark";
  const [copied, setCopied] = React.useState(false);

  const formatted = React.useMemo(() => {
    if (!solution) return "";
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

  return (
    <AnimatePresence>
      {solution && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 240 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[94vw] max-w-[720px] flex-col border-l border-border bg-background shadow-2xl"
          >
            {/* Sticky header */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-7 py-4">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Solution
                </div>
                <h2 className="truncate text-lg font-semibold text-foreground">
                  Walkthrough
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {onApplyToEditor && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplyToEditor(formatted)}
                    className="h-8 rounded-full text-xs"
                  >
                    Paste into editor
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-auto">
              {/* Plain-English summary up top — biggest text, no chrome */}
              {solution.summary && (
                <section className="px-7 pt-7">
                  <p className="text-[17px] leading-relaxed text-foreground">
                    {solution.summary}
                  </p>
                </section>
              )}

              {/* Reference SQL */}
              <section className="px-7 pt-6">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Reference SQL
                  </div>
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
                <div className="overflow-hidden rounded-lg border border-border">
                  <Editor
                    height={Math.min(
                      320,
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

              {/* Steps — bigger, more breathing room */}
              <section className="px-7 pt-8">
                <div className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  How it works, step by step
                </div>
                <ol className="space-y-7">
                  {solution.steps.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * (i + 1) }}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-[11px] font-semibold tabular-nums text-foreground">
                          {i + 1}
                        </span>
                        <h3 className="text-[15px] font-semibold text-foreground">
                          {step.title.replace(/^step\s*\d+:\s*/i, "")}
                        </h3>
                      </div>
                      <div className="mt-2 space-y-3 pl-9">
                        <p className="text-[15px] leading-relaxed text-foreground/90">
                          {step.what_it_does}
                        </p>
                        {step.sql_snippet && (
                          <pre className="overflow-auto rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground">
                            {step.sql_snippet}
                          </pre>
                        )}
                        {step.how_postgres_reads_it && (
                          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
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

              {/* Final thought */}
              {solution.final_thought && (
                <section className="mt-8 border-t border-border bg-muted/30 px-7 py-6">
                  <p className="text-[15px] leading-relaxed text-foreground">
                    {solution.final_thought}
                  </p>
                </section>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
