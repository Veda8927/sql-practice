"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["any", "easy", "medium", "hard"] as const;
type DifficultyChoice = (typeof DIFFICULTIES)[number];

type Props = {
  question: Question | null;
  onNewQuestion: (opts: { concept?: string; difficulty?: string }) => void;
  loading: boolean;
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

export function QuestionBar({ question, onNewQuestion, loading }: Props) {
  const [difficulty, setDifficulty] = React.useState<DifficultyChoice>("any");

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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              disabled={loading}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50",
                difficulty === d
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <Button
            size="sm"
            onClick={() =>
              onNewQuestion({
                difficulty: difficulty === "any" ? undefined : difficulty,
              })
            }
            disabled={loading}
            className="shrink-0 rounded-full"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            New question
          </Button>
        </div>
      </div>
    </div>
  );
}
