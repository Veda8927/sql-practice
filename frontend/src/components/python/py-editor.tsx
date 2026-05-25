"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Loader2, Play, Send } from "lucide-react";

import { HoverExpandButton } from "@/components/hover-expand-button";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  running?: boolean;
  submitting?: boolean;
};

export function PyEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  running = false,
  submitting = false,
}: Props) {
  const { resolvedTheme } = useTheme();
  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;
  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border">
      {/* Command bar — mirrors the SQL editor header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Python editor
        </div>
        <div className="flex items-center gap-1.5">
          <HoverExpandButton
            label="Run"
            shortcut="⌘↵"
            icon={
              running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )
            }
            onClick={onRun}
            disabled={running}
            tone="primary"
          />
          <HoverExpandButton
            label="Submit"
            shortcut="⌘⇧↵"
            icon={
              submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )
            }
            onClick={onSubmit}
            disabled={submitting}
            tone="success"
            alwaysOpen
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <Editor
          height="100%"
          language="python"
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
              onRunRef.current(),
            );
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
              () => onSubmitRef.current(),
            );
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            tabSize: 4,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            padding: { top: 10, bottom: 10 },
            renderWhitespace: "selection",
          }}
        />
      </div>
    </div>
  );
}
