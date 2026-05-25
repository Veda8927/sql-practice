"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Gauge,
  Lightbulb,
  Link2,
  Loader2,
  Search,
  Sigma,
  Sparkles,
  Table2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CoachCard } from "@/components/coach-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HintResponse, Question } from "@/lib/types";
import { cn } from "@/lib/utils";

type DifficultyChoice = "any" | "easy" | "medium" | "hard";
const DIFFICULTY_OPTIONS: SelectOption<DifficultyChoice>[] = [
  {
    value: "any",
    label: "Any level",
  },
  {
    value: "easy",
    label: "Easy",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "hard",
    label: "Hard",
  },
];
type ConceptCategory = {
  id: string;
  label: string;
  description: string;
  concepts: ReadonlyArray<readonly [string, string]>;
};

const CONCEPT_CATEGORIES: readonly ConceptCategory[] = [
  {
    id: "query_patterns",
    label: "Query patterns",
    description: "Joining, filtering, combining row sets",
    concepts: [
      ["joins", "Joins"],
      ["left_joins", "Left joins"],
      ["self_joins", "Self joins"],
      ["full_joins", "Full outer joins"],
      ["lateral_joins", "Lateral joins"],
      ["subqueries", "Subqueries"],
      ["correlated_subqueries", "Correlated subqueries"],
      ["exists", "EXISTS / NOT EXISTS"],
      ["set_operations", "Set operations"],
    ],
  },
  {
    id: "aggregation",
    label: "Aggregation",
    description: "Rolling up rows into summaries",
    concepts: [
      ["aggregations", "Aggregations"],
      ["distinct", "DISTINCT"],
      ["group_by", "Group by"],
      ["having", "Having"],
      ["filter_clause", "FILTER clause"],
      ["grouping_sets", "GROUPING SETS / ROLLUP"],
    ],
  },
  {
    id: "advanced",
    label: "Advanced techniques",
    description: "Window functions, CTEs, pivots",
    concepts: [
      ["window_functions", "Window functions"],
      ["cte", "CTEs"],
      ["recursive_cte", "Recursive CTEs"],
      ["case_when", "CASE WHEN"],
      ["pivot", "Pivot / conditional aggregation"],
    ],
  },
  {
    id: "data_ops",
    label: "Data operations",
    description: "Dates, strings, JSON, arrays, NULLs",
    concepts: [
      ["date_functions", "Date functions"],
      ["string_functions", "String functions"],
      ["regex", "Regex"],
      ["null_handling", "NULL handling"],
      ["json_functions", "JSON functions"],
      ["array_functions", "Array functions"],
    ],
  },
  {
    id: "data_cleaning",
    label: "Data cleaning",
    description: "Deduplication, validation, normalization",
    concepts: [
      ["deduplication", "Deduplication"],
      ["type_casting", "Type casting"],
      ["data_validation", "Data validation"],
      ["standardization", "Standardization"],
    ],
  },
] as const;

type ConceptChoice = string;

const ALL_CONCEPTS: ReadonlyArray<readonly [string, string]> = [
  ["", "Any concept"],
  ...CONCEPT_CATEGORIES.flatMap((c) =>
    c.concepts.map((p) => p as readonly [string, string]),
  ),
];

function findConceptLabel(value: string): string {
  return ALL_CONCEPTS.find(([v]) => v === value)?.[1] ?? "Any concept";
}

function findCategoryIdForConcept(value: string): string | null {
  for (const cat of CONCEPT_CATEGORIES) {
    if (cat.concepts.some(([v]) => v === value)) return cat.id;
  }
  return null;
}

export type QuestionSource = "ai" | "curated";

type Props = {
  question: Question | null;
  onNewQuestion: (opts: { concept?: string; difficulty?: string }) => void;
  loading: boolean;
  onHint: () => void;
  hint: HintResponse | null;
  hintLoading: boolean;
  onDismissHint: () => void;
  onApplyHintSql: (sql: string) => void;
  difficultySuggestion?: DifficultyChoice | null;
  source: QuestionSource;
  onSourceChange: (source: QuestionSource) => void;
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
  group?: string;
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
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  // Compute trigger position whenever the menu opens. Flip above when there
  // isn't room below. Re-close on scroll/resize for crisp popover behavior.
  // The menu is capped at 60vh — pick the larger usable side (above vs below the trigger).
  React.useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const desired = Math.min(
      Math.floor(window.innerHeight * 0.6),
      36 + options.length * 36 + 8 + 60,
    );
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    // The trigger always sits below the prompt, so opening upward would cover
    // the question. Always open downward (into the editor area, which is fine to
    // overlap) and cap the height to the room below so the menu scrolls
    // internally instead of overflowing the viewport.
    const maxHeight = Math.max(0, Math.min(desired, spaceBelow));
    setPos({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [open, options.length]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node;
      // Click outside both the trigger AND the portaled menu = close.
      if (
        !triggerRef.current?.contains(t) &&
        !menuRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => setOpen(false);
    // Only close on OUTER scrolls — ignore scroll events that originate inside the menu.
    const onScroll = (event: Event) => {
      const t = event.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <motion.button
        ref={triggerRef}
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

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 6, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  minWidth: Math.max(pos.width, 240),
                  maxHeight: pos.maxHeight,
                }}
                className="z-50 flex w-64 flex-col overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl shadow-background/40"
              >
            <div className="shrink-0 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {options.map((option, index) => {
                const active = option.value === value;
                const prevGroup = index > 0 ? options[index - 1].group : undefined;
                const showGroupHeader =
                  !!option.group && option.group !== prevGroup;
                return (
                  <React.Fragment key={option.value || "empty"}>
                    {showGroupHeader && (
                      <div className="mt-1 px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {option.group}
                      </div>
                    )}
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.14, delay: Math.min(index, 8) * 0.012 }}
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
                  </React.Fragment>
                );
              })}
            </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function CategoryConceptSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"categories" | "concepts">("categories");
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedLabel = findConceptLabel(value);
  const activeCategory = CONCEPT_CATEGORIES.find((c) => c.id === activeCategoryId);

  // When the menu opens, drill into the category of the currently selected concept
  // so the user lands in context. Reset on close. Auto-focus the search box so
  // typing immediately filters.
  React.useEffect(() => {
    if (!open) {
      setView("categories");
      setActiveCategoryId(null);
      setQuery("");
      return;
    }
    const initial = findCategoryIdForConcept(value);
    if (initial) {
      setActiveCategoryId(initial);
      setView("concepts");
    }
    // Defer to next frame so the input exists in the portal.
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, value]);

  // Flat search across every concept (label + value) plus category match.
  const searchResults = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const out: Array<{
      value: string;
      label: string;
      categoryLabel: string;
    }> = [];
    for (const cat of CONCEPT_CATEGORIES) {
      const catMatch = cat.label.toLowerCase().includes(q);
      for (const [v, label] of cat.concepts) {
        const labelMatch =
          label.toLowerCase().includes(q) || v.toLowerCase().includes(q);
        if (labelMatch || catMatch) {
          out.push({ value: v, label, categoryLabel: cat.label });
        }
      }
    }
    return out;
  }, [query]);

  React.useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const desired = Math.min(Math.floor(window.innerHeight * 0.65), 480);
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    // The trigger always sits below the prompt, so opening upward would cover
    // the question. Always open downward (into the editor area, which is fine to
    // overlap) and cap the height to the room below so the menu scrolls
    // internally instead of overflowing the viewport.
    const maxHeight = Math.max(0, Math.min(desired, spaceBelow));
    setPos({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [open, view]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => setOpen(false);
    const onScroll = (event: Event) => {
      const t = event.target as Node | null;
      if (t && menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const pickConcept = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        ref={triggerRef}
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
          <span className="text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <span className="sr-only">Concept</span>
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className="truncate"
          >
            {selectedLabel}
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

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 6, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  minWidth: Math.max(pos.width, 280),
                  maxHeight: pos.maxHeight,
                }}
                className="z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl shadow-background/40"
              >
                {/* Sticky search header */}
                <div className="shrink-0 p-1">
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search concepts..."
                      className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          searchInputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {searchResults ? (
                    <motion.div
                      key="search"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      {searchResults.length === 0 ? (
                        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                          No matches for &ldquo;{query}&rdquo;
                        </div>
                      ) : (
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {searchResults.map((r) => {
                            const active = r.value === value;
                            return (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => pickConcept(r.value)}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                                  active
                                    ? "bg-muted text-foreground"
                                    : "text-foreground hover:bg-muted/60",
                                )}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-medium">
                                    {r.label}
                                  </span>
                                  <span className="block truncate text-[10px] text-muted-foreground">
                                    {r.categoryLabel}
                                  </span>
                                </span>
                                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ) : view === "categories" ? (
                    <motion.div
                      key="categories"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.14 }}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      <div className="shrink-0 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Concept
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => pickConcept("")}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                            value === ""
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span className="text-xs font-medium">Any concept</span>
                          {value === "" && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <div className="my-1 h-px bg-border/60" />
                        {CONCEPT_CATEGORIES.map((cat) => {
                          const containsSelected = cat.concepts.some(
                            ([v]) => v === value,
                          );
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setActiveCategoryId(cat.id);
                                setView("concepts");
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                                containsSelected
                                  ? "bg-muted/60 text-foreground"
                                  : "text-foreground hover:bg-muted/60",
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium">
                                  {cat.label}
                                </span>
                                <span className="block truncate text-[10px] text-muted-foreground">
                                  {cat.description}
                                </span>
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="concepts"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.14 }}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      <button
                        type="button"
                        onClick={() => setView("categories")}
                        className="flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        <span>{activeCategory?.label ?? "Back"}</span>
                      </button>
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        {activeCategory?.concepts.map(([v, label]) => {
                          const active = v === value;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => pickConcept(v)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                                active
                                  ? "bg-muted text-foreground"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                              )}
                            >
                              <span className="block truncate text-xs font-medium">
                                {label}
                              </span>
                              {active && <Check className="h-3.5 w-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
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
  onApply,
}: {
  hint: HintResponse;
  onDismiss: () => void;
  onApply: (sql: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-4 overflow-hidden"
    >
      <CoachCard
        label="Hint"
        icon={<Lightbulb className="h-3.5 w-3.5 text-amber-500" />}
        onDismiss={onDismiss}
        suggestedSql={hint.suggested_sql}
        onApplySql={onApply}
      >
        {hint.hint}
      </CoachCard>
    </motion.div>
  );
}

function SourceToggle({
  value,
  onChange,
  disabled,
}: {
  value: QuestionSource;
  onChange: (v: QuestionSource) => void;
  disabled?: boolean;
}) {
  const options: { value: QuestionSource; label: string; icon: React.ReactNode; tip: string }[] = [
    { value: "ai", label: "AI", icon: <Sparkles className="h-3 w-3" />, tip: "LLM-generated questions, fresh each time" },
    { value: "curated", label: "Curated", icon: <BookOpen className="h-3 w-3" />, tip: "Hand-vetted interview-style bank" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Question source"
      className={cn(
        "grid h-8 grid-cols-2 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5",
        disabled && "opacity-50",
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={cn(
                  "inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            </TooltipTrigger>
            <TooltipContent>{opt.tip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
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
  onApplyHintSql,
  difficultySuggestion,
  source,
  onSourceChange,
}: Props) {
  const [difficulty, setDifficulty] = React.useState<DifficultyChoice>("any");
  const [concept, setConcept] = React.useState<ConceptChoice>("");

  React.useEffect(() => {
    if (difficultySuggestion) setDifficulty(difficultySuggestion);
  }, [difficultySuggestion]);

  const start = React.useCallback(
    (over?: { concept?: ConceptChoice; difficulty?: DifficultyChoice }) => {
      const c = over?.concept ?? concept;
      const d = over?.difficulty ?? difficulty;
      onNewQuestion({
        concept: c || undefined,
        difficulty: d === "any" ? undefined : d,
      });
    },
    [concept, difficulty, onNewQuestion],
  );

  // Empty state: a calm, OpenAI-style hero — greeting, a rounded prompt bar
  // holding the focus controls, and one-tap quick-start pills.
  if (!question) {
    const quickStarts: { concept: ConceptChoice; label: string; icon: React.ReactNode }[] = [
      { concept: "joins", label: "Joins", icon: <Link2 className="h-4 w-4" /> },
      { concept: "aggregations", label: "Aggregations", icon: <Sigma className="h-4 w-4" /> },
      { concept: "window_functions", label: "Window functions", icon: <BarChart3 className="h-4 w-4" /> },
    ];
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="mb-8 text-center text-[32px] font-semibold tracking-tight text-foreground sm:text-[38px]">
          Ready when you are.
        </h1>

        {/* Prompt bar: focus controls on the left, start on the right. */}
        <div className="flex items-center gap-2 rounded-[26px] border border-border bg-card px-2.5 py-2 shadow-sm transition-shadow focus-within:shadow-md">
          <CategoryConceptSelect
            value={concept}
            onChange={setConcept}
            disabled={loading}
          />
          <CommandSelect
            label="Difficulty"
            value={difficulty}
            options={DIFFICULTY_OPTIONS}
            icon={<Gauge className="h-3.5 w-3.5" />}
            disabled={loading}
            onChange={setDifficulty}
          />
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => start()}
            disabled={loading}
            aria-label="Start question"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Quick-start pills. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {quickStarts.map((q) => (
            <button
              key={q.concept}
              type="button"
              disabled={loading}
              onClick={() => {
                setConcept(q.concept);
                start({ concept: q.concept });
              }}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            >
              <span className="text-muted-foreground">{q.icon}</span>
              {q.label}
            </button>
          ))}
        </div>

        {/* Source: AI-generated vs curated bank. */}
        <div className="mt-8 flex justify-center">
          <div className="w-[220px]">
            <SourceToggle
              value={source}
              onChange={onSourceChange}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-10 flex justify-center">
        <div className="w-[220px]">
          <SourceToggle
            value={source}
            onChange={onSourceChange}
            disabled={loading}
          />
        </div>
      </div>
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
          ) : (
            <motion.h2
              key={question.question}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[20px] font-medium leading-snug tracking-tight text-foreground break-words sm:text-[22px]"
            >
              <WordReveal text={question.question} />
            </motion.h2>
          )}
        </AnimatePresence>
      </div>

      {question && <SchemaContext question={question} />}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CategoryConceptSelect
            value={concept}
            onChange={setConcept}
            disabled={loading}
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
            {question ? "Next question" : "Start question"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {hint && (
          <HintCallout
            hint={hint}
            onDismiss={onDismissHint}
            onApply={onApplyHintSql}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
