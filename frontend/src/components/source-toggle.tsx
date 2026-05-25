"use client";

import * as React from "react";
import { BookOpen, Sparkles } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Source = "ai" | "curated";

// Shared AI / Curated segmented control. Kept presentational so SQL practice,
// Python practice (and Clean) all show the identical source switch.
export function SourceToggle({
  value,
  onChange,
  disabled,
}: {
  value: Source;
  onChange: (v: Source) => void;
  disabled?: boolean;
}) {
  const options: { value: Source; label: string; icon: React.ReactNode; tip: string }[] = [
    { value: "ai", label: "AI", icon: <Sparkles className="h-3 w-3" />, tip: "LLM-generated, fresh each time" },
    { value: "curated", label: "Curated", icon: <BookOpen className="h-3 w-3" />, tip: "Hand-vetted bank" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Source"
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
