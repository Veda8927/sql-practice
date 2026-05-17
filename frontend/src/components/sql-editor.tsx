"use client";

import * as React from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type {
  editor as MonacoEditor,
  languages as MonacoLanguages,
  IDisposable,
} from "monaco-editor";
import { Loader2, Play, Wand2 } from "lucide-react";
import { useTheme } from "next-themes";
import { format as formatSql } from "sql-formatter";

import { Button } from "@/components/ui/button";
import { lintSql, type LintIssue } from "@/lib/sql-lint";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
  schemaIdentifiers: Set<string>;
};

export const PLACEHOLDER = "-- write your SQL here\n";

const MARKER_OWNER = "sql-practice-lint";

export function SqlEditor({
  value,
  onChange,
  onRun,
  running,
  schemaIdentifiers,
}: Props) {
  const editorRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof import("monaco-editor") | null>(null);
  const codeActionDisposableRef = React.useRef<IDisposable | null>(null);
  const issuesRef = React.useRef<LintIssue[]>([]);

  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;

  const schemaIdsRef = React.useRef(schemaIdentifiers);
  schemaIdsRef.current = schemaIdentifiers;

  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "light" ? "vs" : "vs-dark";

  const runLint = React.useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();
    const issues = lintSql(text, schemaIdsRef.current);
    issuesRef.current = issues;

    const markers: MonacoEditor.IMarkerData[] = issues.map((i) => ({
      severity: monaco.MarkerSeverity.Warning,
      message: i.message,
      startLineNumber: i.startLine,
      startColumn: i.startColumn,
      endLineNumber: i.endLine,
      endColumn: i.endColumn,
      source: "sql-lint",
    }));
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }, []);

  const handleFormat = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = editor.getValue();
    try {
      const formatted = formatSql(current, {
        language: "postgresql",
        keywordCase: "upper",
        tabWidth: 2,
        linesBetweenQueries: 1,
      });
      // Replace whole content but preserve cursor at end of formatted text.
      const fullRange = editor.getModel()?.getFullModelRange();
      if (!fullRange) return;
      editor.executeEdits("format-sql", [
        { range: fullRange, text: formatted, forceMoveMarkers: true },
      ]);
      editor.pushUndoStop();
    } catch {
      // sql-formatter throws on unparseable input — silently ignore so the
      // user can still type freely.
    }
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.focus();

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => onRunRef.current(),
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => handleFormat(),
    );

    // Code action provider: offer quick-fix to replace the typo.
    const codeActionProvider: MonacoLanguages.CodeActionProvider = {
      provideCodeActions: (model, _range, context) => {
        const actions: MonacoLanguages.CodeAction[] = [];
        for (const marker of context.markers) {
          if (marker.source !== "sql-lint") continue;
          const issue = issuesRef.current.find(
            (i) =>
              i.startLine === marker.startLineNumber &&
              i.startColumn === marker.startColumn,
          );
          if (!issue) continue;
          actions.push({
            title: `Replace "${issue.wrong}" with "${issue.suggestion}"`,
            diagnostics: [marker],
            kind: "quickfix",
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: {
                    range: {
                      startLineNumber: issue.startLine,
                      startColumn: issue.startColumn,
                      endLineNumber: issue.endLine,
                      endColumn: issue.endColumn,
                    },
                    text: issue.suggestion,
                  },
                },
              ],
            },
            isPreferred: true,
          });
        }
        return { actions, dispose: () => {} };
      },
    };
    codeActionDisposableRef.current =
      monaco.languages.registerCodeActionProvider("sql", codeActionProvider);

    runLint();
  };

  React.useEffect(() => {
    return () => {
      codeActionDisposableRef.current?.dispose();
    };
  }, []);

  // Re-lint whenever the value or schema changes.
  React.useEffect(() => {
    runLint();
  }, [value, schemaIdentifiers, runLint]);

  const isPlaceholder = value === PLACEHOLDER;
  React.useEffect(() => {
    if (isPlaceholder && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isPlaceholder]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <Editor
        height="100%"
        defaultLanguage="sql"
        language="sql"
        theme={monacoTheme}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily:
            "'JetBrains Mono', 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          renderWhitespace: "selection",
          lineNumbersMinChars: 3,
          padding: { top: 12, bottom: 12 },
          lightbulb: { enabled: true } as never,
          quickSuggestions: true,
        }}
      />
      <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2">
        <span className="rounded-md bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
          ⌘↵
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="pointer-events-auto h-8 rounded-full text-xs"
          onClick={handleFormat}
          title="Format (⌘⇧F)"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Format
        </Button>
        <Button
          size="sm"
          className="pointer-events-auto h-8 rounded-full"
          onClick={onRun}
          disabled={running}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run
        </Button>
      </div>
    </div>
  );
}
