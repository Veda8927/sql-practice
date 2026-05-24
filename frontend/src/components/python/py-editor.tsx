"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onSubmit: () => void;
};

export function PyEditor({ value, onChange, onRun, onSubmit }: Props) {
  const { resolvedTheme } = useTheme();
  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;
  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  return (
    <div className="h-full overflow-hidden rounded-md border border-border">
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
  );
}
