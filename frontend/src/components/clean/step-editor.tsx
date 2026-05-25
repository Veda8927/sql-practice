"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Check, Copy } from "lucide-react";

import { formatSqlText } from "@/lib/sql-format";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
};

const MIN_HEIGHT = 72;
const MAX_HEIGHT = 360;

export function StepEditor({ value, onChange, onRun }: Props) {
  const { resolvedTheme } = useTheme();
  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;
  const [height, setHeight] = React.useState(MIN_HEIGHT);
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be blocked (insecure context); fail quietly.
    }
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy SQL"
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <Editor
        height={height}
        language="sql"
        theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={(editor, monaco) => {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
            onRunRef.current(),
          );
          // ⌘F → format this step (overrides Monaco's built-in find).
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
            const formatted = formatSqlText(editor.getValue());
            const range = editor.getModel()?.getFullModelRange();
            if (!range) return;
            editor.executeEdits("format-sql", [
              { range, text: formatted, forceMoveMarkers: true },
            ]);
            editor.pushUndoStop();
          });
          // Grow the editor to fit its content so nothing is hidden behind a
          // tiny fixed viewport.
          const fit = () => {
            const next = Math.min(
              MAX_HEIGHT,
              Math.max(MIN_HEIGHT, editor.getContentHeight()),
            );
            setHeight((prev) => (prev === next ? prev : next));
          };
          editor.onDidContentSizeChange(fit);
          fit();
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          scrollbar: { vertical: "auto", alwaysConsumeMouseWheel: false },
          automaticLayout: true,
          overviewRulerLanes: 0,
        }}
      />
    </div>
  );
}
