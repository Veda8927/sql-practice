"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

import { CoachCard } from "@/components/coach-card";
import type { Insight } from "@/lib/insights";

type Props = {
  insights: Insight[];
};

/**
 * "Tier 2" feedback rendered as standard CoachCards so it visually matches
 * every other tutor surface in the app.
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
            <CoachCard
              key={i}
              label={insight.title}
              icon={<Lightbulb className="h-3.5 w-3.5 text-amber-500" />}
            >
              {insight.detail}
            </CoachCard>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
