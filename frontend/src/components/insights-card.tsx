"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

import type { Insight } from "@/lib/insights";

type Props = {
  insights: Insight[];
};

/**
 * "Tier 2" feedback: surgical hints about WHAT differs between user output
 * and expected output, without revealing how to fix it. Lives above the
 * data table in the result panel.
 */
export function InsightsCard({ insights }: Props) {
  return (
    <AnimatePresence initial={false}>
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="mb-3 space-y-2"
        >
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5"
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium leading-snug text-foreground">
                  {insight.title}
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {insight.detail}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
