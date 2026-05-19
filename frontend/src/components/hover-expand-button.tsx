"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success";

type Props = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: Tone;
  shortcut?: string;
  className?: string;
  // When true, the label is always visible (no hover-to-expand behavior).
  alwaysOpen?: boolean;
};

/**
 * Icon-only by default; the label slides in smoothly on hover/focus.
 *
 * - `neutral` and `primary` are ghost (no border, no fill until hover).
 * - `success` is a solid fill — used for "commit" actions like Submit.
 */
export function HoverExpandButton({
  label,
  icon,
  onClick,
  disabled,
  tone = "neutral",
  shortcut,
  className,
  alwaysOpen = false,
}: Props) {
  const [hovered, setHovered] = React.useState(false);

  // Each tone controls only color, never the layout, so the row of buttons
  // stays visually consistent in size + animation timing.
  // `success` reuses the same primary blue as the Next-question button so the
  // two "commit" actions on the page share a single brand-color vocabulary.
  const toneClasses: Record<Tone, string> = {
    neutral:
      "text-foreground/75 hover:bg-muted hover:text-foreground",
    primary:
      "text-foreground/75 hover:bg-muted hover:text-foreground",
    success:
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  };

  // Apple-style easing for the slide. Slow enough to feel intentional,
  // fast enough to never feel laggy.
  const slideTransition = {
    duration: 0.28,
    ease: [0.32, 0.72, 0, 1] as const,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          layout
          transition={slideTransition}
          whileTap={{ scale: disabled ? 1 : 0.97 }}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className={cn(
            "inline-flex h-8 items-center rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            toneClasses[tone],
            className,
          )}
        >
          <motion.span
            layout
            transition={slideTransition}
            className="flex h-full w-8 items-center justify-center"
          >
            {icon}
          </motion.span>
          {alwaysOpen ? (
            <span className="block whitespace-nowrap pr-2.5 text-xs font-medium">
              {label}
            </span>
          ) : (
            <AnimatePresence initial={false}>
              {hovered && !disabled && (
                <motion.span
                  key="label"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={slideTransition}
                  style={{ overflow: "hidden" }}
                >
                  <span className="block whitespace-nowrap pr-2.5 text-xs font-medium">
                    {label}
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2 text-xs">
          <span>{label}</span>
          {shortcut && (
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {shortcut}
            </kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
