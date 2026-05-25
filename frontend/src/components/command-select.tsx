"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  group?: string;
};

// Styled popover select shared by SQL and Python practice so the concept /
// difficulty controls look and behave identically.
export function CommandSelect<T extends string>({
  label,
  value,
  options,
  icon,
  disabled,
  onChange,
  bare,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  icon: React.ReactNode;
  disabled?: boolean;
  onChange: (value: T) => void;
  bare?: boolean;
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

  return (
    <div className="relative">
      <motion.button
        ref={triggerRef}
        type="button"
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "group inline-flex h-8 items-center justify-between gap-2 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          bare
            ? "gap-1.5 px-2 hover:bg-muted/60"
            : "min-w-[136px] border border-border bg-muted/20 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] hover:border-muted-foreground/35 hover:bg-muted/35",
          open && (bare ? "bg-muted/70" : "border-muted-foreground/35 bg-background"),
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
                className="z-50 flex w-64 flex-col overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                <div className="shrink-0 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {options.map((option, index) => {
                    const active = option.value === value;
                    const prevGroup = index > 0 ? options[index - 1].group : undefined;
                    const showGroupHeader = !!option.group && option.group !== prevGroup;
                    return (
                      <React.Fragment key={option.value || "empty"}>
                        {showGroupHeader && (
                          <div className="mt-1 px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            {option.group}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left transition-colors",
                            active
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span className="block truncate text-xs font-medium">
                            {option.label}
                          </span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
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
