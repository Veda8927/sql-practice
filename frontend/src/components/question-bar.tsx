"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Lightbulb, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["any", "easy", "medium", "hard"] as const;
type DifficultyChoice = (typeof DIFFICULTIES)[number];

type Props = {
  question: Question | null;
  onNewQuestion: (opts: { concept?: string; difficulty?: string }) => void;
  loading: boolean;
  onHint: () => void;
  hint: string | null;
  hintLoading: boolean;
  onDismissHint: () => void;
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

export function QuestionBar({
  question,
  onNewQuestion,
  loading,
  onHint,
  hint,
  hintLoading,
  onDismissHint,
}: Props) {
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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {question && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onHint}
                  disabled={hintLoading || !question}
                  className="shrink-0 rounded-full text-xs"
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
            {question ? "Next question" : "Start"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-4 overflow-hidden"
          >
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="flex-1 text-sm leading-relaxed text-foreground">
                {hint}
              </p>
              <button
                type="button"
                onClick={onDismissHint}
                aria-label="Dismiss hint"
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
