"use client";

import * as React from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type {
  editor as MonacoEditor,
  languages as MonacoLanguages,
  IDisposable,
} from "monaco-editor";
import { CheckCircle2, Loader2, Play, Wand2 } from "lucide-react";
import { useTheme } from "next-themes";

import { EditorOutline } from "@/components/editor-outline";
import { HoverExpandButton } from "@/components/hover-expand-button";
import { lintSql, type LintIssue } from "@/lib/sql-lint";
import { formatSqlText } from "@/lib/sql-format";

type SchemaTable = {
  name: string;
  columns: { name: string; type: string }[];
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  running: boolean;
  submitting: boolean;
  schemaIdentifiers: Set<string>;
  schemaTables?: SchemaTable[];
  expectedTables?: string[];
};

export const PLACEHOLDER = "";

const MARKER_OWNER = "sql-practice-lint";

export function SqlEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  running,
  submitting,
  schemaIdentifiers,
  schemaTables,
  expectedTables,
}: Props) {
  const editorRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof import("monaco-editor") | null>(null);
  const codeActionDisposableRef = React.useRef<IDisposable | null>(null);
  const issuesRef = React.useRef<LintIssue[]>([]);

  const onRunRef = React.useRef(onRun);
  onRunRef.current = onRun;

  const onSubmitRef = React.useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const schemaIdsRef = React.useRef(schemaIdentifiers);
  schemaIdsRef.current = schemaIdentifiers;

  const schemaTablesRef = React.useRef(schemaTables ?? []);
  schemaTablesRef.current = schemaTables ?? [];

  const completionDisposableRef = React.useRef<IDisposable | null>(null);

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
    const formatted = formatSqlText(editor.getValue());
    const fullRange = editor.getModel()?.getFullModelRange();
    if (!fullRange) return;
    editor.executeEdits("format-sql", [
      { range: fullRange, text: formatted, forceMoveMarkers: true },
    ]);
    editor.pushUndoStop();
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.focus();

    // ⌘F → Format (overrides Monaco's built-in find dialog).
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
      () => handleFormat(),
    );
    // ⌘R → Run.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR,
      () => onRunRef.current(),
    );
    // ⌘S → Submit.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => onSubmitRef.current(),
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

    const SQL_KEYWORDS = [
      "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
      "OFFSET", "JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN",
      "INNER JOIN", "ON", "AS", "AND", "OR", "NOT", "NULL", "IS", "IN",
      "BETWEEN", "LIKE", "ILIKE", "EXISTS", "DISTINCT", "UNION", "UNION ALL",
      "INTERSECT", "EXCEPT", "CASE", "WHEN", "THEN", "ELSE", "END", "WITH",
      "RECURSIVE", "OVER", "PARTITION BY", "ROWS", "RANGE", "ASC", "DESC",
      "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
      "DATE_TRUNC", "EXTRACT", "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG",
      "LEAD", "FIRST_VALUE", "LAST_VALUE", "FILTER",
    ];

    const completionProvider: MonacoLanguages.CompletionItemProvider = {
      triggerCharacters: [".", " "],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const tables = schemaTablesRef.current;
        const textUpToCursor = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Build alias map from the whole document.
        const fullText = model.getValue();
        const aliasMap = new Map<string, string>();
        const aliasRegex =
          /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w]*)(?:\s+(?:AS\s+)?([a-zA-Z_][\w]*))?/gi;
        let am: RegExpExecArray | null;
        while ((am = aliasRegex.exec(fullText)) !== null) {
          const tableName = am[1];
          const aliasName = am[2];
          if (
            aliasName &&
            aliasName.toLowerCase() !== "where" &&
            aliasName.toLowerCase() !== "on"
          ) {
            aliasMap.set(aliasName, tableName);
          }
          aliasMap.set(tableName, tableName);
        }

        // Did the user just type `<ident>.`? Suggest columns from that table.
        const dotMatch = textUpToCursor.match(/([a-zA-Z_][\w]*)\.\w*$/);
        if (dotMatch) {
          const ident = dotMatch[1];
          const tableName =
            aliasMap.get(ident) ?? aliasMap.get(ident.toLowerCase()) ?? ident;
          const tbl = tables.find(
            (t) => t.name.toLowerCase() === tableName.toLowerCase(),
          );
          if (tbl) {
            const dotPos = textUpToCursor.lastIndexOf(".");
            const colRange = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: dotPos + 2,
              endColumn: position.column,
            };
            return {
              suggestions: tbl.columns.map((c) => ({
                label: c.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: c.name,
                detail: c.type,
                range: colRange,
              })),
            };
          }
        }

        const suggestions: MonacoLanguages.CompletionItem[] = [];
        const fromJoinMatch = /\b(FROM|JOIN)\s+\w*$/i.test(textUpToCursor);
        if (fromJoinMatch) {
          for (const t of tables) {
            suggestions.push({
              label: t.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: t.name,
              detail: `table (${t.columns.length} cols)`,
              range,
            });
          }
          return { suggestions };
        }

        for (const t of tables) {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: t.name,
            detail: "table",
            range,
          });
          for (const c of t.columns) {
            suggestions.push({
              label: c.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: c.name,
              detail: `${t.name} · ${c.type}`,
              range,
            });
          }
        }
        for (const kw of SQL_KEYWORDS) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        }
        return { suggestions };
      },
    };
    completionDisposableRef.current =
      monaco.languages.registerCompletionItemProvider("sql", completionProvider);

    runLint();
  };

  React.useEffect(() => {
    return () => {
      codeActionDisposableRef.current?.dispose();
      completionDisposableRef.current?.dispose();
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

  // Listen for the global ⌘F format event dispatched by the page-level
  // shortcut handler so format works even when the editor isn't focused.
  React.useEffect(() => {
    const h = () => handleFormat();
    window.addEventListener("sqlpractice:format", h);
    return () => window.removeEventListener("sqlpractice:format", h);
  }, [handleFormat]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Top nav of the editor — label on the left, actions on the right */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          SQL editor
        </div>
        <div className="flex items-center gap-1.5">
          <HoverExpandButton
            label="Format"
            shortcut="⌘F"
            icon={<Wand2 className="h-3.5 w-3.5" />}
            onClick={handleFormat}
            tone="neutral"
          />
          <HoverExpandButton
            label="Run"
            shortcut="⌘R"
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
            shortcut="⌘S"
            icon={
              submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
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
      </div>
      <EditorOutline
        sql={value}
        schemaIdentifiers={schemaIdentifiers}
        expectedTables={expectedTables}
      />
    </div>
  );
}
