"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HelpCircle,
  Keyboard,
  Loader2,
  Moon,
  RotateCcw,
  Sun,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type Layout,
} from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SchemaModal } from "@/components/schema-modal";
import { QuestionBar } from "@/components/question-bar";
import { SqlEditor, PLACEHOLDER } from "@/components/sql-editor";
import { ResultsPanel } from "@/components/results-panel";
import { AnswerSheet } from "@/components/answer-sheet";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import {
  StreakBadge,
  recordStreak,
  resetStreak,
} from "@/components/streak-badge";
import { api } from "@/lib/api";
import { collectSchemaIdentifiers } from "@/lib/sql-lint";
import type {
  ExplainResponse,
  GiveUpResponse,
  GradeResult,
  Question,
  SchemaInfo,
} from "@/lib/types";

function useSplitDirection(): "horizontal" | "vertical" {
  const [horizontal, setHorizontal] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setHorizontal(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return horizontal ? "horizontal" : "vertical";
}

const SPLIT_LAYOUT_STORAGE_KEY = "sql-practice:split-layouts";

function ThemeToggleInline() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : true;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
          className="rounded-full"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Switch to {isDark ? "light" : "dark"} mode
      </TooltipContent>
    </Tooltip>
  );
}

export default function Page() {
  const queryClient = useQueryClient();
  const splitDirection = useSplitDirection();
  const [splitLayouts, setSplitLayouts] = React.useState<
    Partial<Record<"horizontal" | "vertical", Layout>>
  >({});

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SPLIT_LAYOUT_STORAGE_KEY);
      if (stored) {
        setSplitLayouts(JSON.parse(stored));
      }
    } catch {
      // Ignore invalid stored layouts and fall back to the default split.
    }
  }, []);

  const saveSplitLayout = React.useCallback(
    (layout: Layout) => {
      setSplitLayouts((current) => {
        const next = { ...current, [splitDirection]: layout };
        try {
          window.localStorage.setItem(
            SPLIT_LAYOUT_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          // Resizing should continue even if storage is unavailable.
        }
        return next;
      });
    },
    [splitDirection],
  );

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
  const [hint, setHint] = React.useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [lastRunMs, setLastRunMs] = React.useState<number | null>(null);
  const runStartRef = React.useRef<number | null>(null);

  const newQuestionMutation = useMutation({
    mutationFn: (opts: { concept?: string; difficulty?: string } | undefined) =>
      api.newQuestion(opts),
    onSuccess: (q) => {
      setQuestion(q);
      setSql(PLACEHOLDER);
      setResult(null);
      setExplanation(null);
      setSolution(null);
      setHint(null);
      setLastRunMs(null);
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
      setHint(null);
      setLastRunMs(null);
      resetStreak();
      toast.success(
        `New scenario: ${schema.scenario_label} · seed ${schema.seed}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (s: string) => {
      runStartRef.current = performance.now();
      return await api.submit(s);
    },
    onSuccess: (r) => {
      const ms =
        runStartRef.current !== null
          ? Math.round(performance.now() - runStartRef.current)
          : null;
      setLastRunMs(ms);
      setResult(r);
      setExplanation(null);
      // Record streak for any executed query (correct vs. not). Errors don't
      // count as attempts so users aren't punished for syntax.
      if (r.status === "correct" || r.status === "wrong") {
        recordStreak(r.status === "correct");
      }
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

  const hintMutation = useMutation({
    mutationFn: () => api.hint(sql === PLACEHOLDER ? undefined : sql),
    onSuccess: (r) => setHint(r.hint),
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
    if (!window.confirm("Regenerate the database with a new scenario?")) return;
    resetDataMutation.mutate();
  }, [resetDataMutation]);

  const onGiveUp = React.useCallback(() => {
    if (!question) {
      toast.error("Generate a question first.");
      return;
    }
    giveUpMutation.mutate();
  }, [question, giveUpMutation]);

  // Keyboard shortcuts.
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
      // ⌘S is captured inside Monaco for format; nothing global to do.
    };
    const helpHandler = (e: KeyboardEvent) => {
      // `?` opens the shortcuts modal — but only when not typing in an input.
      if (e.key !== "?" || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      const inForm =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest(".monaco-editor"));
      if (inForm) return;
      e.preventDefault();
      setShortcutsOpen(true);
    };
    window.addEventListener("keydown", helpHandler);
    const cleanupHelp = () =>
      window.removeEventListener("keydown", helpHandler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      cleanupHelp();
    };
  }, [onRun, onNewQuestion]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Minimal header */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[13px] font-semibold tracking-tight">
            SQL Practice
          </h1>
          <StreakBadge />
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSchemaOpen(true)}
                className="h-8 gap-1.5 rounded-full px-2 text-xs sm:px-3"
              >
                <Table2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Schema</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View tables, columns, and joins</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onGiveUp}
                disabled={!question || giveUpMutation.isPending}
                className="h-8 gap-1.5 rounded-full px-2 text-xs sm:px-3"
              >
                {giveUpMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <HelpCircle className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Show answer</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Reveal the answer with a step-by-step walkthrough
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onReset}
                disabled={resetDataMutation.isPending}
                className="rounded-full"
                aria-label="Regenerate data"
              >
                {resetDataMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Regenerate database with a new scenario
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                className="rounded-full"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Keyboard shortcuts — <kbd className="font-mono">?</kbd>
            </TooltipContent>
          </Tooltip>
          <ThemeToggleInline />
        </div>
      </header>

      {/* Main column */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <section className="shrink-0">
          <QuestionBar
            question={question}
            loading={newQuestionMutation.isPending}
            onNewQuestion={onNewQuestion}
            onHint={() => hintMutation.mutate()}
            hint={hint}
            hintLoading={hintMutation.isPending}
            onDismissHint={() => setHint(null)}
          />
        </section>

        <section className="min-h-0 flex-1 border-t border-border">
          <PanelGroup
            key={`${splitDirection}:${splitLayouts[splitDirection] ? "saved" : "default"}`}
            id={`sql-practice-split-${splitDirection}`}
            orientation={splitDirection}
            defaultLayout={splitLayouts[splitDirection]}
            onLayoutChanged={saveSplitLayout}
            className="h-full w-full"
          >
            <Panel
              id="editor"
              defaultSize="50%"
              minSize="20%"
              className="min-h-0 min-w-0"
            >
              <SqlEditor
                value={sql}
                onChange={setSql}
                onRun={onRun}
                running={submitMutation.isPending}
                schemaIdentifiers={schemaIdentifiers}
              />
            </Panel>
            <PanelResizeHandle
              className={
                splitDirection === "horizontal"
                  ? "group relative w-px bg-border transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/50"
                  : "group relative h-px bg-border transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/50"
              }
            >
              <div
                className={
                  splitDirection === "horizontal"
                    ? "absolute inset-y-0 -left-1.5 w-3"
                    : "absolute inset-x-0 -top-1.5 h-3"
                }
                aria-hidden
              />
            </PanelResizeHandle>
            <Panel
              id="results"
              defaultSize="50%"
              minSize="20%"
              className="min-h-0 min-w-0"
            >
              <ResultsPanel
                result={result}
                expectedPreview={question?.expected_output ?? null}
                explanation={explanation}
                explainLoading={explainMutation.isPending}
                onExplain={() => explainMutation.mutate()}
                lastRunMs={lastRunMs}
              />
            </Panel>
          </PanelGroup>
        </section>
      </main>

      <SchemaModal
        open={schemaOpen}
        schema={schemaQuery.data}
        onClose={() => setSchemaOpen(false)}
      />

      <AnswerSheet
        solution={solution}
        onClose={() => setSolution(null)}
        onApplyToEditor={(s) => {
          setSql(s);
          setSolution(null);
        }}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
