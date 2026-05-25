"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Code2,
  Database,
  History,
  Keyboard,
  Loader2,
  Moon,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Sun,
  Table2,
  Terminal,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  usePanelRef,
  type Layout,
} from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SchemaModal } from "@/components/schema-modal";
import { QuestionBar, type QuestionSource } from "@/components/question-bar";
import { SqlEditor, PLACEHOLDER } from "@/components/sql-editor";
import { ResultsPanel } from "@/components/results-panel";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import { SyllabusView } from "@/components/syllabus-view";
import { CleanView } from "@/components/clean/clean-view";
import { PythonView } from "@/components/python/python-view";
import {
  StreakBadge,
  recordStreak,
  resetStreak,
} from "@/components/streak-badge";
import { api } from "@/lib/api";
import {
  curatedGiveUp,
  curatedHintAt,
  loadConceptBank,
  pickCuratedQuestion,
} from "@/lib/curated";
import { collectSchemaIdentifiers } from "@/lib/sql-lint";
import { cn } from "@/lib/utils";
import type {
  CuratedQuestion,
  Difficulty,
  ExplainResponse,
  ErrorHelpResponse,
  GiveUpResponse,
  GradeResult,
  HintResponse,
  PerformanceResponse,
  Question,
  QuestionHistoryItem,
  RunQueryResponse,
  SchemaInfo,
} from "@/lib/types";

const SOURCE_STORAGE_KEY = "sql-practice:source";

function loadSource(): QuestionSource {
  try {
    const v = window.localStorage.getItem(SOURCE_STORAGE_KEY);
    return v === "curated" ? "curated" : "ai";
  } catch {
    return "ai";
  }
}

type Language = "sql" | "python";
type Mode = "practice" | "learn" | "clean";
const LANGUAGE_STORAGE_KEY = "sql-practice:language";

function loadLanguage(): Language {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "python"
      ? "python"
      : "sql";
  } catch {
    return "sql";
  }
}

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
const VSPLIT_LAYOUT_STORAGE_KEY = "sql-practice:vsplit-layout:v3";
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

  // Imperative handle for the question panel so we can resize it to fit
  // whatever the current question + schema-context block actually needs.
  const questionPanelRef = usePanelRef();
  const questionContentRef = React.useRef<HTMLDivElement>(null);

  // Observe the QuestionBar's natural height and resize the top panel to match,
  // so long questions never get clipped on small viewports. The user can still
  // drag the divider afterwards — we only fire when the content height changes,
  // not on every render.
  React.useEffect(() => {
    const el = questionContentRef.current;
    if (!el) return;
    let frame = 0;
    const obs = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const h = el.scrollHeight;
        if (h > 0) questionPanelRef.current?.resize(`${h + 16}px`);
      });
    });
    obs.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, [questionPanelRef]);

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
  const [runResult, setRunResult] = React.useState<RunQueryResponse | null>(
    null,
  );
  const [explanation, setExplanation] =
    React.useState<ExplainResponse | null>(null);
  const [solution, setSolution] = React.useState<GiveUpResponse | null>(null);
  const [schemaOpen, setSchemaOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [tourStep, setTourStep] = React.useState(0);
  const [hint, setHint] = React.useState<HintResponse | null>(null);
  const [source, setSourceState] = React.useState<QuestionSource>("ai");
  const [curatedQuestion, setCuratedQuestion] =
    React.useState<CuratedQuestion | null>(null);
  const [curatedHintIndex, setCuratedHintIndex] = React.useState(0);
  const [language, setLanguageState] = React.useState<Language>("sql");
  const [mode, setMode] = React.useState<Mode>("practice");
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
    setRunResult(null);
    setExplanation(null);
    setSolution(null);
    setHint(null);
    setCuratedHintIndex(0);
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
      setCuratedQuestion(null);
      activateQuestion(q);
      queryClient.invalidateQueries({ queryKey: ["question-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const curatedLoadMutation = useMutation({
    mutationFn: async (opts: {
      concept?: string;
      difficulty?: string;
    } | undefined): Promise<{ q: Question; cq: CuratedQuestion }> => {
      const conceptSlug = opts?.concept ?? "joins";
      const bank = await loadConceptBank(conceptSlug);
      if (bank.length === 0) {
        throw new Error(
          `No curated questions yet for "${conceptSlug}". Try "joins" or switch to AI mode.`,
        );
      }
      const diff = opts?.difficulty as Difficulty | undefined;
      const cq = pickCuratedQuestion(bank, {
        difficulty: diff,
        excludeId: curatedQuestion?.id ?? null,
      });
      if (!cq) {
        throw new Error(
          `No curated questions at difficulty "${diff}" for "${conceptSlug}".`,
        );
      }
      const q = await api.loadCurated(cq);
      return { q, cq };
    },
    onSuccess: ({ q, cq }) => {
      setCuratedQuestion(cq);
      activateQuestion(q);
      // Refresh the schema panel so the new curated tables appear.
      queryClient.invalidateQueries({ queryKey: ["schema"] });
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
    mutationFn: (opts?: { mode?: "auto" | "ai" | "ai_fresh" }) =>
      api.resetData(opts),
    onSuccess: (schema) => {
      queryClient.setQueryData(["schema"], schema);
      setQuestion(null);
      setSql(PLACEHOLDER);
      setResult(null);
    setRunResult(null);
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

  const runQueryMutation = useMutation({
    mutationFn: async (s: string) => {
      runStartRef.current = performance.now();
      return await api.runQuery(s);
    },
    onSuccess: (r) => {
      const ms =
        runStartRef.current !== null
          ? Math.round(performance.now() - runStartRef.current)
          : null;
      setLastRunMs(ms);
      setRunResult(r);
      // Free-form Run clears any prior graded state so the panel
      // doesn't mix "your last grade" with "your latest run".
      setResult(null);
      setExplanation(null);
      setErrorHelp(null);
      setPerformanceReview(null);
      if (r.status === "error" && r.error_message) {
        toast.error(r.error_message);
      }
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
      setRunResult(null);
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
    runQueryMutation.mutate(sql);
  }, [question, sql, runQueryMutation]);

  const onSubmit = React.useCallback(() => {
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
    (opts?: { concept?: string; difficulty?: string }) => {
      if (source === "curated") {
        curatedLoadMutation.mutate(opts);
      } else {
        newQuestionMutation.mutate(opts);
      }
    },
    [source, curatedLoadMutation, newQuestionMutation],
  );

  const onSourceChange = React.useCallback((next: QuestionSource) => {
    setSourceState(next);
    try {
      window.localStorage.setItem(SOURCE_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
    // Switching source invalidates the active question — its schema is
    // about to be replaced by the other side. Clear so the empty state
    // re-appears and the user starts fresh.
    setQuestion(null);
    setCuratedQuestion(null);
    setSql(PLACEHOLDER);
    setResult(null);
    setRunResult(null);
    setExplanation(null);
    setSolution(null);
    setHint(null);
  }, []);

  // Restore the saved source choice on mount.
  React.useEffect(() => {
    setSourceState(loadSource());
  }, []);

  // Restore the saved language on mount.
  React.useEffect(() => {
    setLanguageState(loadLanguage());
  }, []);

  const onLanguageChange = React.useCallback(
    (next: Language) => {
      setLanguageState(next);
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // Best effort.
      }
      // Python has no Clean mode — fall back to Practice when switching.
      setMode((m) => (next === "python" && m === "clean" ? "practice" : m));
    },
    [],
  );

  const onCuratedHint = React.useCallback(() => {
    if (!curatedQuestion) return;
    setHint(curatedHintAt(curatedQuestion, curatedHintIndex));
    setCuratedHintIndex((i) =>
      Math.min(i + 1, curatedQuestion.hints.length - 1),
    );
  }, [curatedQuestion, curatedHintIndex]);

  const onReset = React.useCallback(() => {
    if (!window.confirm("Regenerate the database with a new scenario?")) return;
    resetDataMutation.mutate({ mode: "auto" });
  }, [resetDataMutation]);

  const onAiScenario = React.useCallback(() => {
    if (
      !window.confirm(
        "Generate a brand-new AI-designed schema? This can take 10–30 seconds.",
      )
    )
      return;
    resetDataMutation.mutate({ mode: "ai_fresh" });
  }, [resetDataMutation]);

  // Auto-fetch the solution for whatever question is currently active.
  // The backend pre-computes it in the background when the question is
  // generated, so this call is usually instant from cache. We only fire
  // once per question id and never override an already-present solution.
  const solutionFetchedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!question) return;
    if (solutionFetchedRef.current === question.id) return;
    if (solution) return;
    solutionFetchedRef.current = question.id;
    // Curated questions pre-bake their solution — skip the LLM call.
    if (curatedQuestion && curatedQuestion.id === question.id) {
      setSolution(curatedGiveUp(curatedQuestion));
      return;
    }
    giveUpMutation.mutate();
  }, [question, solution, giveUpMutation, curatedQuestion]);

  // Keyboard shortcuts. Capture phase so we beat the browser AND Monaco
  // defaults (⌘F find, ⌘R reload, ⌘S save) before they can fire.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // These shortcuts drive the SQL practice editor; let Clean/Python/Learn
      // handle their own keys instead of swallowing them here.
      if (language !== "sql" || mode !== "practice") return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "f") {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("sqlpractice:format"));
      } else if (k === "r") {
        e.preventDefault();
        e.stopPropagation();
        onRun();
      } else if (k === "s") {
        e.preventDefault();
        e.stopPropagation();
        onSubmit();
      } else if (k === "n") {
        e.preventDefault();
        e.stopPropagation();
        onNewQuestion(undefined);
      }
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
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      cleanupHelp();
    };
  }, [onRun, onSubmit, onNewQuestion, mode, language]);

  // Activities are contextual to the language: Clean is SQL-only.
  const modeTabs: { id: Mode; label: string; icon: React.ReactNode }[] =
    language === "sql"
      ? [
          { id: "learn", label: "Learn", icon: <BookOpen className="h-3.5 w-3.5" /> },
          { id: "practice", label: "Practice", icon: <PlayCircle className="h-3.5 w-3.5" /> },
          { id: "clean", label: "Clean", icon: <Wand2 className="h-3.5 w-3.5" /> },
        ]
      : [
          { id: "learn", label: "Learn", icon: <BookOpen className="h-3.5 w-3.5" /> },
          { id: "practice", label: "Practice", icon: <PlayCircle className="h-3.5 w-3.5" /> },
        ];

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Minimal header */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Terminal
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          {/* Primary axis: which language you're practicing */}
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
            {(
              [
                { id: "sql", label: "SQL", icon: <Database className="h-3.5 w-3.5" /> },
                { id: "python", label: "Python", icon: <Code2 className="h-3.5 w-3.5" /> },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onLanguageChange(l.id)}
                aria-pressed={language === l.id}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
                  language === l.id
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.icon}
                {l.label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border" aria-hidden />
          {/* Secondary axis: activity within the selected language */}
          <div className="flex items-center gap-0.5">
            {modeTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                aria-pressed={mode === t.id}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  mode === t.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          {language === "sql" && mode === "practice" && <StreakBadge />}
        </div>
        <div className="flex items-center gap-1">
          {language === "sql" && mode === "practice" && (
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
              Shuffle to a built-in scenario
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onAiScenario}
                disabled={resetDataMutation.isPending}
                className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Generate AI scenario"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Generate a brand-new AI-designed schema (10–30s)
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
        {language === "python" ? (
          <PythonView
            view={mode === "learn" ? "learn" : "practice"}
            onSwitchToPractice={() => setMode("practice")}
          />
        ) : mode === "clean" ? (
          <CleanView />
        ) : mode === "learn" ? (
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
            defaultSize="40%"
            minSize="12%"
            panelRef={questionPanelRef}
            className={`min-h-0 ${tourClass("question")}`}
          >
            {/*
              Pattern for "center if it fits, scroll if it doesn't":
              outer scroller + inner min-h-full flex centerer.
            */}
            <div className="h-full overflow-auto">
              <div className="flex min-h-full items-center justify-center">
                <div ref={questionContentRef} className="w-full">
          <QuestionBar
            question={question}
            loading={
              source === "curated"
                ? curatedLoadMutation.isPending
                : newQuestionMutation.isPending
            }
            onNewQuestion={onNewQuestion}
            onHint={
              source === "curated"
                ? onCuratedHint
                : () => hintMutation.mutate()
            }
            hint={hint}
            hintLoading={source === "curated" ? false : hintMutation.isPending}
            onDismissHint={() => setHint(null)}
            onApplyHintSql={(suggested) => {
              setSql(suggested);
              setHint(null);
            }}
            difficultySuggestion={difficultySuggestion}
            source={source}
            onSourceChange={onSourceChange}
          />
                </div>
              </div>
            </div>
          </Panel>
          <PanelResizeHandle
            className="group relative h-px bg-border transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/50"
          >
            <div className="absolute inset-x-0 -top-1.5 h-3" aria-hidden />
          </PanelResizeHandle>
          <Panel id="working" defaultSize="60%" minSize="30%" className="min-h-0">
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
                onSubmit={onSubmit}
                submitting={submitMutation.isPending}
                running={runQueryMutation.isPending}
                schemaIdentifiers={schemaIdentifiers}
                schemaTables={schemaQuery.data?.tables}
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
                runResult={runResult}
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
                solution={solution}
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
