"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  height?: number;
};

export function StepEditor({ value, onChange, onRun, height = 120 }: Props) {
  const { resolvedTheme } = useTheme();
  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;
  return (
    <div className="overflow-hidden rounded-md border border-border">
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
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          scrollbar: { vertical: "auto" },
        }}
      />
    </div>
  );
}
