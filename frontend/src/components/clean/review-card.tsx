"use client";

import * as React from "react";
import { CheckCircle2, Lightbulb, Sparkles, TriangleAlert } from "lucide-react";
import type { ReviewResponse } from "@/lib/clean-types";

export function ReviewCard({ review }: { review: ReviewResponse }) {
  const tone =
    review.score >= 80 ? "text-emerald-600" : review.score >= 50 ? "text-amber-600" : "text-destructive";
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI review
        </div>
        <div className={`text-2xl font-bold tabular-nums ${tone}`}>
          {review.score}
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-sm text-foreground/90">{review.assessment}</p>
      {review.praise.length > 0 && (
        <Section
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          title="Done well"
          items={review.praise}
        />
      )}
      {review.remaining_issues.length > 0 && (
        <Section
          icon={<TriangleAlert className="h-4 w-4 text-amber-600" />}
          title="Still to fix"
          items={review.remaining_issues}
        />
      )}
      {review.suggestions.length > 0 && (
        <Section
          icon={<Lightbulb className="h-4 w-4 text-primary" />}
          title="Suggestions"
          items={review.suggestions}
        />
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </div>
      <ul className="ml-1 flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-foreground/85">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
