"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  History,
  HelpCircle,
  Keyboard,
  Loader2,
  Moon,
  PlayCircle,
  RotateCcw,
  Sun,
  Table2,
  X,
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
import { SyllabusView } from "@/components/syllabus-view";
import {
  StreakBadge,
  recordStreak,
  resetStreak,
} from "@/components/streak-badge";
import { api } from "@/lib/api";
import { collectSchemaIdentifiers } from "@/lib/sql-lint";
import { cn } from "@/lib/utils";
import type {
  ExplainResponse,
  ErrorHelpResponse,
  GiveUpResponse,
  GradeResult,
  HintResponse,
  PerformanceResponse,
  Question,
  QuestionHistoryItem,
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
const VSPLIT_LAYOUT_STORAGE_KEY = "sql-practice:vsplit-layout";
const DRAFT_PREFIX = "sql-practice:draft:";
const TOUR_STEPS = [
  {
    target: "question",
    title: "Start with the question",
    body: "Read the prompt, then use Concept and Difficulty when you want focused practice.",
  },
  {
    target: "schema",
    title: "Open the schema only when needed",
    body: "The Schema button shows the full table map, relationships, samples, and search.",
  },
  {
    target: "history",
    title: "Return to recent questions",
    body: "History keeps the last 10 questions in this session and restores your saved draft for each one.",
  },
  {
    target: "editor",
    title: "Write and run SQL here",
    body: "Your draft saves automatically per question. Use Run or Cmd/Ctrl+Enter when you are ready.",
  },
  {
    target: "results",
    title: "Learn from the result panel",
    body: "Compare expected output, download CSVs, translate Postgres errors, and review query speed with EXPLAIN.",
  },
] as const;

type TourTarget = (typeof TOUR_STEPS)[number]["target"];

function draftKey(questionId: string) {
  return `${DRAFT_PREFIX}${questionId}`;
}

function loadDraft(questionId: string) {
  try {
    return window.localStorage.getItem(draftKey(questionId));
  } catch {
    return null;
  }
}

function saveDraft(questionId: string, value: string) {
  try {
    window.localStorage.setItem(draftKey(questionId), value);
  } catch {
    // Draft save is best effort.
  }
}

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
          className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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

  const [vsplitLayout, setVsplitLayout] = React.useState<Layout | undefined>(
    undefined,
  );

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VSPLIT_LAYOUT_STORAGE_KEY);
      if (stored) setVsplitLayout(JSON.parse(stored));
    } catch {
      // ignore corrupt stored layout
    }
  }, []);

  const saveVsplitLayout = React.useCallback((layout: Layout) => {
    setVsplitLayout(layout);
    try {
      window.localStorage.setItem(
        VSPLIT_LAYOUT_STORAGE_KEY,
        JSON.stringify(layout),
      );
    } catch {
      // storage is best-effort
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

  const historyQuery = useQuery<QuestionHistoryItem[]>({
    queryKey: ["question-history"],
    queryFn: api.questionHistory,
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
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [tourStep, setTourStep] = React.useState(0);
  const [hint, setHint] = React.useState<HintResponse | null>(null);
  const [mode, setMode] = React.useState<"practice" | "learn">("practice");
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [lastRunMs, setLastRunMs] = React.useState<number | null>(null);
  const [errorHelp, setErrorHelp] = React.useState<ErrorHelpResponse | null>(
    null,
  );
  const [performanceReview, setPerformanceReview] =
    React.useState<PerformanceResponse | null>(null);
  const [difficultySuggestion, setDifficultySuggestion] = React.useState<
    "any" | "easy" | "medium" | "hard" | null
  >(null);
  const runStartRef = React.useRef<number | null>(null);
  const questionStartRef = React.useRef<number | null>(null);
  const easyCorrectRunRef = React.useRef(0);

  const activateQuestion = React.useCallback((q: Question) => {
    setQuestion(q);
    setSql(loadDraft(q.id) ?? PLACEHOLDER);
    setResult(null);
    setExplanation(null);
    setSolution(null);
    setHint(null);
    setLastRunMs(null);
    setErrorHelp(null);
    setPerformanceReview(null);
    // Sync the difficulty pill to whatever the LLM actually returned.
    // "Any" was a request; once a question lands, the pill should match reality.
    if (q.difficulty === "easy" || q.difficulty === "medium" || q.difficulty === "hard") {
      setDifficultySuggestion(q.difficulty);
    }
    questionStartRef.current = performance.now();
  }, []);

  const newQuestionMutation = useMutation({
    mutationFn: (opts: { concept?: string; difficulty?: string } | undefined) =>
      api.newQuestion(opts),
    onSuccess: (q) => {
      activateQuestion(q);
      queryClient.invalidateQueries({ queryKey: ["question-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectQuestionMutation = useMutation({
    mutationFn: (id: string) => api.selectQuestion(id),
    onSuccess: (q) => {
      activateQuestion(q);
      setHistoryOpen(false);
      queryClient.invalidateQueries({ queryKey: ["question-history"] });
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
      setErrorHelp(null);
      setPerformanceReview(null);
      queryClient.invalidateQueries({ queryKey: ["question-history"] });
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
      setErrorHelp(null);
      setPerformanceReview(null);
      // Record streak for any executed query (correct vs. not). Errors don't
      // count as attempts so users aren't punished for syntax.
      if (r.status === "correct" || r.status === "wrong") {
        const durationMs =
          questionStartRef.current !== null
            ? Math.round(performance.now() - questionStartRef.current)
            : undefined;
        recordStreak(r.status === "correct", {
          durationMs,
          difficulty: question?.difficulty,
        });
        if (r.status === "correct" && question?.difficulty === "easy") {
          easyCorrectRunRef.current += 1;
          if (easyCorrectRunRef.current >= 3) {
            setDifficultySuggestion("medium");
            toast.success("You are cruising on Easy. Try Medium next.");
            easyCorrectRunRef.current = 0;
          }
        } else if (r.status === "wrong") {
          easyCorrectRunRef.current = 0;
        }
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
    onSuccess: (r) => setHint(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const errorHelpMutation = useMutation({
    mutationFn: () => api.errorHelp(),
    onSuccess: (r) => setErrorHelp(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const performanceMutation = useMutation({
    mutationFn: () => api.performance(sql),
    onSuccess: (r) => setPerformanceReview(r),
    onError: (e: Error) => toast.error(e.message),
  });

  React.useEffect(() => {
    if (!question) return;
    if (sql === PLACEHOLDER) return;
    saveDraft(question.id, sql);
  }, [question, sql]);

  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem("sql-practice:tour-seen")) {
        setTourOpen(true);
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const closeTour = React.useCallback(() => {
    setTourOpen(false);
    setTourStep(0);
    try {
      window.localStorage.setItem("sql-practice:tour-seen", "1");
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const activeTour = tourOpen ? TOUR_STEPS[tourStep] : null;
  const tourClass = React.useCallback(
    (target: TourTarget) =>
      activeTour?.target === target
        ? "relative z-[70] ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
        : "",
    [activeTour],
  );

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
            SQL
          </h1>
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode("learn")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                mode === "learn"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Learn
            </button>
            <button
              type="button"
              onClick={() => setMode("practice")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                mode === "practice"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Practice
            </button>
          </div>
          {mode === "practice" && <StreakBadge />}
        </div>
        <div className="flex items-center gap-1">
          {mode === "practice" && (
            <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSchemaOpen(true)}
                className={`h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3 ${tourClass("schema")}`}
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
                onClick={() => setHistoryOpen(true)}
                className={`h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3 ${tourClass("history")}`}
              >
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">History</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Revisit recent questions and drafts</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onGiveUp}
                disabled={!question || giveUpMutation.isPending}
                className="h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3"
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
                className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
                className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Keyboard shortcuts — <kbd className="font-mono">?</kbd>
            </TooltipContent>
          </Tooltip>
            </>
          )}
          <ThemeToggleInline />
        </div>
      </header>

      {/* Main column */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {mode === "learn" ? (
          <SyllabusView
            onPracticeConcept={(concept, difficulty) => {
              setMode("practice");
              newQuestionMutation.mutate({ concept, difficulty });
            }}
          />
        ) : (
          <>
        <PanelGroup
          orientation="vertical"
          id="sql-practice-vsplit"
          defaultLayout={vsplitLayout}
          onLayoutChanged={saveVsplitLayout}
          className="h-full w-full"
        >
          <Panel
            id="question"
            defaultSize="30%"
            minSize="12%"
            className={`min-h-0 ${tourClass("question")}`}
          >
            <div className="h-full overflow-auto">
          <QuestionBar
            question={question}
            loading={newQuestionMutation.isPending}
            onNewQuestion={onNewQuestion}
            onHint={() => hintMutation.mutate()}
            hint={hint}
            hintLoading={hintMutation.isPending}
            onDismissHint={() => setHint(null)}
            onApplyHintSql={(suggested) => {
              setSql(suggested);
              setHint(null);
            }}
            difficultySuggestion={difficultySuggestion}
          />
            </div>
          </Panel>
          <PanelResizeHandle
            className="group relative h-px bg-border transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/50"
          >
            <div className="absolute inset-x-0 -top-1.5 h-3" aria-hidden />
          </PanelResizeHandle>
          <Panel id="working" defaultSize="70%" minSize="30%" className="min-h-0">
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
              className={`min-h-0 min-w-0 ${tourClass("editor")}`}
            >
              <SqlEditor
                value={sql}
                onChange={setSql}
                onRun={onRun}
                running={submitMutation.isPending}
                schemaIdentifiers={schemaIdentifiers}
                expectedTables={question?.schema_context?.tables.map(
                  (t) => t.name,
                )}
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
              className={`min-h-0 min-w-0 ${tourClass("results")}`}
            >
              <ResultsPanel
                result={result}
                expectedPreview={question?.expected_output ?? null}
                explanation={explanation}
                explainLoading={explainMutation.isPending}
                onExplain={() => explainMutation.mutate()}
                errorHelp={errorHelp}
                errorHelpLoading={errorHelpMutation.isPending}
                onErrorHelp={() => errorHelpMutation.mutate()}
                performance={performanceReview}
                performanceLoading={performanceMutation.isPending}
                onPerformance={() => performanceMutation.mutate()}
                onApplySql={setSql}
                lastRunMs={lastRunMs}
                orderedResults={question?.ordered_results ?? false}
              />
            </Panel>
          </PanelGroup>
          </Panel>
        </PanelGroup>
          </>
        )}
      </main>

      <SchemaModal
        open={schemaOpen}
        schema={schemaQuery.data}
        onClose={() => setSchemaOpen(false)}
      />

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close history"
            className="absolute inset-0 cursor-default"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="relative flex h-full w-[min(420px,92vw)] flex-col border-l border-border bg-background shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Question history</h2>
                <p className="text-xs text-muted-foreground">
                  Last 10 questions in this session
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHistoryOpen(false)}
                className="rounded-full"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {historyQuery.data?.length ? (
                <div className="space-y-2">
                  {historyQuery.data.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectQuestionMutation.mutate(item.id)}
                      className="block w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="text-sm leading-snug text-foreground">
                        {item.question}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          {item.difficulty}
                        </span>
                        {item.concepts.slice(0, 3).map((concept) => (
                          <span
                            key={concept}
                            className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {concept.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No questions yet.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

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

      {tourOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-background/70" />
          <div className="fixed inset-x-4 bottom-4 z-[80] mx-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border bg-background p-4 shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto sm:mx-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step {tourStep + 1} of {TOUR_STEPS.length}
              </div>
              <button
                type="button"
                onClick={closeTour}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Skip
              </button>
            </div>
            <h2 className="text-base font-semibold">{activeTour?.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {activeTour?.body}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setTourStep((step) => Math.max(0, step - 1))}
                disabled={tourStep === 0}
                className="rounded-full"
              >
                Back
              </Button>
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((step, index) => (
                  <button
                    key={step.target}
                    type="button"
                    aria-label={`Go to tour step ${index + 1}`}
                    onClick={() => setTourStep(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === tourStep
                        ? "w-6 bg-primary"
                        : "w-1.5 bg-muted-foreground/35"
                    }`}
                  />
                ))}
              </div>
              <Button
                onClick={() => {
                  if (tourStep === TOUR_STEPS.length - 1) {
                    closeTour();
                  } else {
                    setTourStep((step) => step + 1);
                  }
                }}
                className="rounded-full"
              >
                {tourStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
