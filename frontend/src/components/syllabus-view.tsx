"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SYLLABUS, type Module, type Topic } from "@/lib/syllabus";
import { cn } from "@/lib/utils";

type Props = {
  onPracticeConcept: (concept: string) => void;
};

export function SyllabusView({ onPracticeConcept }: Props) {
  const [activeTopicId, setActiveTopicId] = React.useState<string>(
    SYLLABUS[0]?.topics[0]?.id ?? "",
  );
  const [openModules, setOpenModules] = React.useState<Record<string, boolean>>(
    () => ({ [SYLLABUS[0]?.id ?? ""]: true }),
  );

  const toggleModule = (id: string) =>
    setOpenModules((p) => ({ ...p, [id]: !p[id] }));

  const activeTopic: { module: Module; topic: Topic } | null = React.useMemo(() => {
    for (const m of SYLLABUS) {
      const t = m.topics.find((t) => t.id === activeTopicId);
      if (t) return { module: m, topic: t };
    }
    return null;
  }, [activeTopicId]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-[320px] shrink-0 border-r border-border bg-muted/20 md:block">
        <ScrollArea className="h-full">
          <div className="px-5 py-5">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Roadmap</h2>
            </div>

            <div className="space-y-1">
              {SYLLABUS.map((module, i) => {
                const isOpen = !!openModules[module.id];
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
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-[13px] font-medium text-foreground">
                        {module.title}
                      </span>
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
                                <span className="truncate">{topic.title}</span>
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
                <div className="mt-10 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">
                      Try a question on this
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Switches to Practice mode with this concept pre-selected.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      onPracticeConcept(activeTopic.topic.practiceConcept!)
                    }
                    className="shrink-0 rounded-full"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Practice
                  </Button>
                </div>
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
