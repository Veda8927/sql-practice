"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Check, ChevronDown, PlayCircle, Wand2 } from "lucide-react";
import { PythonLogo, SqlLogo } from "@/components/brand-logos";
import { cn } from "@/lib/utils";

type Language = "sql" | "python";
type Mode = "practice" | "learn" | "clean";

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: "learn", label: "Learn", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "practice", label: "Practice", icon: <PlayCircle className="h-3.5 w-3.5" /> },
  { id: "clean", label: "Clean", icon: <Wand2 className="h-3.5 w-3.5" /> },
];

const LANGS: {
  id: Language;
  label: string;
  logo: (filled: boolean) => React.ReactNode;
}[] = [
  { id: "sql", label: "SQL", logo: (f) => <SqlLogo className="h-4 w-4" filled={f} /> },
  {
    id: "python",
    label: "Python",
    logo: (f) => <PythonLogo className="h-4 w-4" filled={f} />,
  },
];

// Primary nav: one pill, two language buttons. Hovering a button drops a
// Learn/Practice/Clean list beneath it; picking one switches to that
// language+activity. The active button reads "SQL Practice", the other just
// "Python" — so the label always says exactly where you are.
export function LanguageModeNav({
  language,
  mode,
  onLanguageChange,
  onModeChange,
}: {
  language: Language;
  mode: Mode;
  onLanguageChange: (l: Language) => void;
  onModeChange: (m: Mode) => void;
}) {
  const [openLang, setOpenLang] = React.useState<Language | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenLang(null), 120);
  }, [cancelClose]);
  React.useEffect(() => () => cancelClose(), [cancelClose]);

  const activeModeLabel = MODES.find((m) => m.id === mode)?.label ?? "";

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
      {LANGS.map((l) => {
        const active = language === l.id;
        const open = openLang === l.id;
        return (
          <div
            key={l.id}
            className="relative"
            onMouseEnter={() => {
              cancelClose();
              setOpenLang(l.id);
            }}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              onClick={() => onLanguageChange(l.id)}
              aria-pressed={active}
              aria-expanded={open}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full pl-3 pr-2 text-xs font-semibold transition-colors",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.logo(active)}
              <span>{active ? `${l.label} ${activeModeLabel}` : l.label}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 shrink-0 transition-transform duration-200",
                  open && "rotate-180",
                  active ? "text-background/70" : "text-muted-foreground",
                )}
              />
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  className="absolute left-0 top-full z-50 mt-1.5 flex w-40 flex-col overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                >
                  {MODES.map((m) => {
                    const current = active && mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (!active) onLanguageChange(l.id);
                          onModeChange(m.id);
                          setOpenLang(null);
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                          current
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span className="text-muted-foreground">{m.icon}</span>
                        <span className="flex-1">{m.label}</span>
                        {current && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
