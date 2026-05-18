"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SYLLABUS, type Module, type Topic } from "@/lib/syllabus";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "medium" | "hard";

type Props = {
  onPracticeConcept: (concept: string, difficulty?: Difficulty) => void;
};

function topicMatches(t: Topic, q: string): boolean {
  if (!q) return true;
  const haystack = (
    t.title +
    " " +
    t.blurb +
    " " +
    t.body.join(" ") +
    " " +
    t.examples.map((e) => e.code + " " + (e.note ?? "")).join(" ")
  ).toLowerCase();
  return haystack.includes(q);
}

/** Highlight occurrences of `query` inside `text` with a subtle bg. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-500/30 px-0.5 text-foreground">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SyllabusView({ onPracticeConcept }: Props) {
  const [activeTopicId, setActiveTopicId] = React.useState<string>(
    SYLLABUS[0]?.topics[0]?.id ?? "",
  );
  const [openModules, setOpenModules] = React.useState<Record<string, boolean>>(
    () => ({ [SYLLABUS[0]?.id ?? ""]: true }),
  );
  const [search, setSearch] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement | null>(null);

  // ⌘K / Ctrl+K focuses the search.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const q = search.trim().toLowerCase();

  const filtered: Module[] = React.useMemo(() => {
    if (!q) return SYLLABUS;
    return SYLLABUS.map((m) => ({
      ...m,
      topics: m.topics.filter((t) => topicMatches(t, q)),
    })).filter((m) => m.topics.length > 0);
  }, [q]);

  // When searching, auto-expand every module that has matches.
  React.useEffect(() => {
    if (!q) return;
    const next: Record<string, boolean> = {};
    filtered.forEach((m) => {
      next[m.id] = true;
    });
    setOpenModules(next);
  }, [q, filtered]);

  const toggleModule = (id: string) =>
    setOpenModules((p) => ({ ...p, [id]: !p[id] }));

  const activeTopic: { module: Module; topic: Topic } | null = React.useMemo(
    () => {
      for (const m of SYLLABUS) {
        const t = m.topics.find((t) => t.id === activeTopicId);
        if (t) return { module: m, topic: t };
      }
      return null;
    },
    [activeTopicId],
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-[340px] shrink-0 border-r border-border bg-muted/20 md:flex md:flex-col">
        <div className="border-b border-border px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Roadmap</h2>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics…"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-9 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 py-3">
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No topics match{" "}
                <span className="font-mono text-foreground">{search}</span>.
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((module) => {
                  const isOpen = !!openModules[module.id];
                  const moduleIndex = SYLLABUS.findIndex(
                    (m) => m.id === module.id,
                  );
                  return (
                    <div key={module.id}>
                      <button
                        type="button"
                        onClick={() => toggleModule(module.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-background text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {moduleIndex + 1}
                        </span>
                        <span className="flex-1 truncate text-[13px] font-medium text-foreground">
                          {module.title}
                        </span>
                        {q && (
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                            {module.topics.length}
                          </span>
                        )}
                      </button>
                      {isOpen && (
                        <ul className="mb-2 ml-7 space-y-0.5 border-l border-border pl-2">
                          {module.topics.map((topic) => {
                            const isActive = topic.id === activeTopicId;
                            return (
                              <li key={topic.id}>
                                <button
                                  type="button"
                                  onClick={() => setActiveTopicId(topic.id)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] transition-colors",
                                    isActive
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                  )}
                                >
                                  <span className="truncate">
                                    <Highlight text={topic.title} query={q} />
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Content pane */}
      <ScrollArea className="min-w-0 flex-1">
        {activeTopic ? (
          <article className="mx-auto max-w-2xl px-6 py-10 sm:px-8 sm:py-12">
            <motion.div
              key={activeTopic.topic.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {activeTopic.module.title}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {activeTopic.topic.title}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {activeTopic.topic.blurb}
              </p>

              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground">
                {activeTopic.topic.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {activeTopic.topic.examples.length > 0 && (
                <div className="mt-8 space-y-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Examples
                  </div>
                  {activeTopic.topic.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-lg border border-border bg-muted/30"
                    >
                      <pre className="overflow-auto px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-foreground">
                        {ex.code}
                      </pre>
                      {ex.note && (
                        <div className="border-t border-border bg-background/60 px-3.5 py-2 text-[12.5px] text-muted-foreground">
                          {ex.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTopic.topic.practiceConcept && (
                <PracticeCta
                  concept={activeTopic.topic.practiceConcept}
                  onPractice={onPracticeConcept}
                />
              )}

              <NavButtons
                topicId={activeTopic.topic.id}
                onNavigate={setActiveTopicId}
                onOpenModule={(id) =>
                  setOpenModules((p) => ({ ...p, [id]: true }))
                }
              />
            </motion.div>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Pick a topic from the sidebar.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function PracticeCta({
  concept,
  onPractice,
}: {
  concept: string;
  onPractice: (concept: string, difficulty?: Difficulty) => void;
}) {
  return (
    <div className="mt-10 overflow-hidden rounded-xl border border-border bg-muted/20">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Practice this concept
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Switches to Practice mode with{" "}
            <span className="font-mono">{concept}</span> selected.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => onPractice(concept)}
          className="shrink-0 rounded-full"
        >
          Start
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-border bg-background/40 px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Or pick difficulty
        </span>
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPractice(concept, d)}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium capitalize text-foreground transition-colors hover:bg-muted"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function NavButtons({
  topicId,
  onNavigate,
  onOpenModule,
}: {
  topicId: string;
  onNavigate: (id: string) => void;
  onOpenModule: (id: string) => void;
}) {
  const flat = React.useMemo(
    () =>
      SYLLABUS.flatMap((m) =>
        m.topics.map((t) => ({ topicId: t.id, moduleId: m.id })),
      ),
    [],
  );
  const idx = flat.findIndex((x) => x.topicId === topicId);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
      <Button
        variant="ghost"
        size="sm"
        disabled={!prev}
        onClick={() => {
          if (!prev) return;
          onOpenModule(prev.moduleId);
          onNavigate(prev.topicId);
        }}
        className="rounded-full"
      >
        ← Previous
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!next}
        onClick={() => {
          if (!next) return;
          onOpenModule(next.moduleId);
          onNavigate(next.topicId);
        }}
        className="rounded-full"
      >
        Next →
      </Button>
    </div>
  );
}
