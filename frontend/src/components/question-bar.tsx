"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Filter,
  Gauge,
  Lightbulb,
  Link2,
  Loader2,
  Table2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

type DifficultyChoice = "any" | "easy" | "medium" | "hard";
const DIFFICULTY_OPTIONS: SelectOption<DifficultyChoice>[] = [
  {
    value: "any",
    label: "Any level",
    description: "Let the tutor choose",
  },
  {
    value: "easy",
    label: "Easy",
    description: "Filters and simple groups",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Joins and aggregation",
  },
  {
    value: "hard",
    label: "Hard",
    description: "CTEs, windows, subqueries",
  },
];
const CONCEPTS = [
  ["", "Any concept"],
  ["joins", "Joins"],
  ["aggregations", "Aggregations"],
  ["group_by", "Group by"],
  ["having", "Having"],
  ["window_functions", "Windows"],
  ["cte", "CTEs"],
  ["subqueries", "Subqueries"],
  ["case_when", "CASE"],
  ["date_functions", "Dates"],
  ["null_handling", "NULLs"],
] as const;
type ConceptChoice = (typeof CONCEPTS)[number][0];
const CONCEPT_OPTIONS: SelectOption<ConceptChoice>[] = CONCEPTS.map(
  ([value, label]) => ({
    value,
    label,
    description:
      value === ""
        ? "Mix concepts"
        : value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }),
);

type Props = {
  question: Question | null;
  onNewQuestion: (opts: { concept?: string; difficulty?: string }) => void;
  loading: boolean;
  onHint: () => void;
  hint: string | null;
  hintLoading: boolean;
  onDismissHint: () => void;
  difficultySuggestion?: DifficultyChoice | null;
};

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function WordReveal({ text }: { text: string }) {
  const words = text.split(/(\s+)/);
  return (
    <span>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.4) }}
          style={{ whiteSpace: "pre-wrap" }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

function CommandSelect<T extends string>({
  label,
  value,
  options,
  icon,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  icon: React.ReactNode;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "group inline-flex h-8 min-w-[136px] items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-2.5 text-xs font-medium text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-colors",
          "hover:border-muted-foreground/35 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          open && "border-muted-foreground/35 bg-background",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="sr-only">{label}</span>
          <motion.span
            key={selected.value}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="truncate"
          >
            {selected.label}
          </motion.span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 6, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-0 top-full z-30 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl shadow-background/40"
          >
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            {options.map((option, index) => {
              const active = option.value === value;
              return (
                <motion.button
                  key={option.value || "empty"}
                  type="button"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.14, delay: index * 0.018 }}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.75 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.75 }}
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 28,
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SchemaContext({ question }: { question: Question }) {
  const context = question.schema_context;
  const [expanded, setExpanded] = React.useState(true);
  if (!context || context.tables.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-4 rounded-lg border border-border bg-background"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/35"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
            <Table2 className="h-3 w-3 text-muted-foreground" />
          </span>
          <span className="truncate text-xs font-medium text-foreground">
            Question context
          </span>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {context.tables.map((table) => table.name).join(", ")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            !expanded && "-rotate-90",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="grid gap-0 divide-y divide-border sm:grid-cols-[1fr_auto_1fr] sm:divide-x sm:divide-y-0">
              <div className="min-w-0 p-3">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tables and columns
                </div>
                <div className="space-y-2">
                  {context.tables.map((table) => (
                    <div
                      key={table.name}
                      className="grid grid-cols-[88px_1fr] items-start gap-2"
                    >
                      <div className="truncate font-mono text-[12px] font-medium text-foreground">
                        {table.name}
                      </div>
                      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
                        {table.columns.length > 0 ? (
                          table.columns.map((column) => (
                            <span
                              key={column}
                              className="font-mono text-[11px] text-muted-foreground"
                            >
                              {column}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            relevant table
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {context.joins.length > 0 && (
                <>
                  <div className="hidden w-px bg-border sm:block" />
                  <div className="min-w-0 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      Joins
                    </div>
                    <div className="space-y-1.5">
                      {context.joins.map((join) => (
                        <div
                          key={`${join.from_table}.${join.from_column}-${join.to_table}.${join.to_column}`}
                          className="flex min-w-0 items-center gap-2 font-mono text-[11px]"
                          title={`${join.from_table}.${join.from_column} → ${join.to_table}.${join.to_column}`}
                        >
                          <span className="truncate text-foreground">
                            {join.from_table}.{join.from_column}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="truncate text-foreground">
                            {join.to_table}.{join.to_column}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HintCallout({
  hint,
  onDismiss,
}: {
  hint: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-4 overflow-hidden"
    >
      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            </span>
            <span className="text-xs font-medium text-foreground">
              Tutor hint
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss hint"
            className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
        <p className="px-3 py-2.5 text-sm leading-relaxed text-foreground">
          {hint}
        </p>
      </div>
    </motion.div>
  );
}

export function QuestionBar({
  question,
  onNewQuestion,
  loading,
  onHint,
  hint,
  hintLoading,
  onDismissHint,
  difficultySuggestion,
}: Props) {
  const [difficulty, setDifficulty] = React.useState<DifficultyChoice>("any");
  const [concept, setConcept] = React.useState<ConceptChoice>("");

  React.useEffect(() => {
    if (difficultySuggestion) setDifficulty(difficultySuggestion);
  }, [difficultySuggestion]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="min-h-[64px]">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-base text-muted-foreground"
            >
              <ThinkingDots />
              <span>Writing your question…</span>
            </motion.div>
          ) : question ? (
            <motion.h2
              key={question.question}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[20px] font-medium leading-snug tracking-tight text-foreground break-words sm:text-[22px]"
            >
              <WordReveal text={question.question} />
            </motion.h2>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[22px] font-medium leading-snug tracking-tight text-muted-foreground"
            >
              Press <span className="text-foreground">New question</span> to begin.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {question && <SchemaContext question={question} />}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CommandSelect
            label="Concept"
            value={concept}
            options={CONCEPT_OPTIONS}
            icon={<Filter className="h-3.5 w-3.5" />}
            disabled={loading}
            onChange={setConcept}
          />
          <CommandSelect
            label="Difficulty"
            value={difficulty}
            options={DIFFICULTY_OPTIONS}
            icon={<Gauge className="h-3.5 w-3.5" />}
            disabled={loading}
            onChange={setDifficulty}
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {question && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onHint}
                  disabled={hintLoading || !question}
                  className="h-8 shrink-0 rounded-lg text-xs"
                >
                  {hintLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5" />
                  )}
                  Hint
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Nudge in the right direction — no answer reveal
              </TooltipContent>
            </Tooltip>
          )}
          <Button
            size="sm"
            onClick={() =>
              onNewQuestion({
                concept: concept || undefined,
                difficulty: difficulty === "any" ? undefined : difficulty,
              })
            }
            disabled={loading}
            className="h-8 shrink-0 rounded-lg"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            {question ? "Next question" : "Start"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {hint && <HintCallout hint={hint} onDismiss={onDismissHint} />}
      </AnimatePresence>
    </div>
  );
}
