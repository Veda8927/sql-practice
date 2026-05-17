"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  HelpCircle,
  Loader2,
  Moon,
  RotateCcw,
  Sun,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { SchemaPanel } from "@/components/schema-panel";
import { QuestionBar } from "@/components/question-bar";
import { SqlEditor, PLACEHOLDER } from "@/components/sql-editor";
import { ResultsPanel } from "@/components/results-panel";
import { AnswerSheet } from "@/components/answer-sheet";
import { api } from "@/lib/api";
import { collectSchemaIdentifiers } from "@/lib/sql-lint";
import type {
  ExplainResponse,
  GiveUpResponse,
  GradeResult,
  Question,
  SchemaInfo,
} from "@/lib/types";

function ThemeToggleInline() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : true;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="rounded-full"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default function Page() {
  const queryClient = useQueryClient();

  const schemaQuery = useQuery<SchemaInfo>({
    queryKey: ["schema"],
    queryFn: api.getSchema,
  });

  const schemaIdentifiers = React.useMemo(
    () => collectSchemaIdentifiers(schemaQuery.data?.tables ?? []),
    [schemaQuery.data],
  );

  const [question, setQuestion] = React.useState<Question | null>(null);
  const [sql, setSql] = React.useState<string>(PLACEHOLDER);
  const [result, setResult] = React.useState<GradeResult | null>(null);
  const [explanation, setExplanation] =
    React.useState<ExplainResponse | null>(null);
  const [solution, setSolution] = React.useState<GiveUpResponse | null>(null);
  const [schemaOpen, setSchemaOpen] = React.useState(false);

  const newQuestionMutation = useMutation({
    mutationFn: (opts: { concept?: string; difficulty?: string } | undefined) =>
      api.newQuestion(opts),
    onSuccess: (q) => {
      setQuestion(q);
      setSql(PLACEHOLDER);
      setResult(null);
      setExplanation(null);
      setSolution(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDataMutation = useMutation({
    mutationFn: () => api.resetData(),
    onSuccess: (schema) => {
      queryClient.setQueryData(["schema"], schema);
      setQuestion(null);
      setSql(PLACEHOLDER);
      setResult(null);
      setExplanation(null);
      setSolution(null);
      toast.success(`Data reset · seed ${schema.seed}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: (s: string) => api.submit(s),
    onSuccess: (r) => {
      setResult(r);
      setExplanation(null);
      if (r.status === "correct") toast.success("Correct");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const explainMutation = useMutation({
    mutationFn: () => api.explain(sql),
    onSuccess: (r) => setExplanation(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const giveUpMutation = useMutation({
    mutationFn: () => api.giveUp(),
    onSuccess: (r) => setSolution(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const onRun = React.useCallback(() => {
    if (!question) {
      toast.error("Generate a question first.");
      return;
    }
    const trimmed = sql.trim();
    if (!trimmed || trimmed === PLACEHOLDER.trim()) {
      toast.error("Write some SQL.");
      return;
    }
    submitMutation.mutate(sql);
  }, [question, sql, submitMutation]);

  const onNewQuestion = React.useCallback(
    (opts?: { concept?: string; difficulty?: string }) =>
      newQuestionMutation.mutate(opts),
    [newQuestionMutation],
  );

  const onReset = React.useCallback(() => {
    if (!window.confirm("Regenerate the database with a new seed?")) return;
    resetDataMutation.mutate();
  }, [resetDataMutation]);

  const onGiveUp = React.useCallback(() => {
    if (!question) {
      toast.error("Generate a question first.");
      return;
    }
    giveUpMutation.mutate();
  }, [question, giveUpMutation]);

  // Shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onRun();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewQuestion(undefined);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onRun, onNewQuestion]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Minimal header */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[13px] font-semibold tracking-tight">
            SQL Practice
          </h1>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSchemaOpen((v) => !v)}
            className="h-8 gap-1.5 rounded-full px-2 text-xs sm:px-3"
            title="Schema"
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Schema</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onGiveUp}
            disabled={!question || giveUpMutation.isPending}
            className="h-8 gap-1.5 rounded-full px-2 text-xs sm:px-3"
            title="Show answer"
          >
            {giveUpMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HelpCircle className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Show answer</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            disabled={resetDataMutation.isPending}
            className="rounded-full"
            title="Regenerate data"
          >
            {resetDataMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </Button>
          <ThemeToggleInline />
        </div>
      </header>

      {/* Main column — generous max-width, vertical stack */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Question */}
        <section className="shrink-0">
          <QuestionBar
            question={question}
            loading={newQuestionMutation.isPending}
            onNewQuestion={onNewQuestion}
          />
        </section>

        {/* Editor + result, split horizontally */}
        <section className="grid min-h-0 flex-1 grid-rows-[minmax(180px,1fr)_minmax(180px,1fr)] divide-y divide-border border-t border-border md:grid-cols-2 md:grid-rows-1 md:divide-x md:divide-y-0">
          <div className="min-h-0 overflow-hidden">
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={onRun}
              running={submitMutation.isPending}
              schemaIdentifiers={schemaIdentifiers}
            />
          </div>
          <div className="min-h-0 overflow-hidden">
            <ResultsPanel
              result={result}
              expectedPreview={question?.expected_output ?? null}
              explanation={explanation}
              explainLoading={explainMutation.isPending}
              onExplain={() => explainMutation.mutate()}
            />
          </div>
        </section>
      </main>

      {/* Schema drawer */}
      <AnimatePresence>
        {schemaOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSchemaOpen(false)}
              className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] border-r border-border bg-background shadow-2xl"
            >
              <SchemaPanel schema={schemaQuery.data} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Answer sheet */}
      <AnswerSheet
        solution={solution}
        onClose={() => setSolution(null)}
        onApplyToEditor={(s) => {
          setSql(s);
          setSolution(null);
        }}
      />
    </div>
  );
}
