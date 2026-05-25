"use client";

import * as React from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { Lightbulb, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PyEditor } from "@/components/python/py-editor";
import { PyPrompt } from "@/components/python/py-prompt";
import { TestResults } from "@/components/python/test-results";
import { SyllabusView } from "@/components/syllabus-view";
import { PY_SYLLABUS } from "@/lib/python-syllabus";
import { pythonApi } from "@/lib/python-api";
import {
  curatedPyHintAt,
  listPyConcepts,
  loadPyConceptBank,
  pickPyExercise,
} from "@/lib/python-curated";
import type {
  PyDifficulty,
  PyExercise,
  PyExplainResponse,
  PyGiveUpResponse,
  PyGradeResult,
  PyHintResponse,
  PyQuestion,
  PyRunResponse,
} from "@/lib/python-types";

type Source = "ai" | "curated";
const DIFFS: PyDifficulty[] = ["easy", "medium", "hard"];

function useWide() {
  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

type PythonViewProps = {
  view: "learn" | "practice";
  onSwitchToPractice: () => void;
};

export function PythonView({ view, onSwitchToPractice }: PythonViewProps) {
  const wide = useWide();
  const concepts = React.useMemo(() => listPyConcepts(), []);
  const [source, setSource] = React.useState<Source>("ai");
  const [concept, setConcept] = React.useState(concepts[0]?.concept ?? "basics");
  const [difficulty, setDifficulty] = React.useState<PyDifficulty>("easy");

  const [question, setQuestion] = React.useState<PyQuestion | null>(null);
  const [curated, setCurated] = React.useState<PyExercise | null>(null);
  const [code, setCode] = React.useState("");
  const [runResult, setRunResult] = React.useState<PyRunResponse | null>(null);
  const [grade, setGrade] = React.useState<PyGradeResult | null>(null);
  const [hint, setHint] = React.useState<PyHintResponse | null>(null);
  const hintIndex = React.useRef(0);
  const [explanation, setExplanation] = React.useState<PyExplainResponse | null>(null);
  const [solution, setSolution] = React.useState<PyGiveUpResponse | null>(null);

  const [loadingNew, setLoadingNew] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [coachBusy, setCoachBusy] = React.useState(false);
  const [tab, setTab] = React.useState("output");

  const codeRef = React.useRef(code);
  codeRef.current = code;
  const questionRef = React.useRef(question);
  questionRef.current = question;
  const viewRef = React.useRef(view);
  viewRef.current = view;

  function resetCoach() {
    setRunResult(null);
    setGrade(null);
    setHint(null);
    setExplanation(null);
    setSolution(null);
    hintIndex.current = 0;
  }

  const runNew = React.useCallback(
    async (src: Source, con: string, diff: PyDifficulty) => {
      setLoadingNew(true);
      resetCoach();
      try {
        if (src === "curated") {
          const bank = await loadPyConceptBank(con);
          const ex = pickPyExercise(bank, { difficulty: diff, excludeId: questionRef.current?.id ?? null });
          if (!ex) {
            toast.error(`No curated ${diff} exercises for "${con}" yet. Try AI mode or another concept.`);
            return;
          }
          const q = await pythonApi.loadCurated(ex);
          setQuestion(q);
          setCurated(ex);
          setCode(ex.starter_code || "");
        } else {
          const q = await pythonApi.newQuestion({ concept: con, difficulty: diff });
          setQuestion(q);
          setCurated(null);
          setCode(q.starter_code || "");
        }
        setTab("output");
      } catch (e) {
        toast.error(String((e as Error).message));
      } finally {
        setLoadingNew(false);
      }
    },
    [],
  );

  const newExercise = React.useCallback(
    () => runNew(source, concept, difficulty),
    [runNew, source, concept, difficulty],
  );

  function practiceConcept(con: string) {
    onSwitchToPractice();
    setSource("ai"); // AI mode handles any concept, including ones without a curated bank
    setConcept(con);
    void runNew("ai", con, difficulty);
  }

  async function run() {
    if (!question) return;
    setRunning(true);
    try {
      const r = await pythonApi.run(codeRef.current);
      setRunResult(r);
      setTab("output");
      if (r.timed_out) toast.error("Your code ran too long and was stopped.");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!question) return;
    setSubmitting(true);
    try {
      const g = await pythonApi.submit(codeRef.current);
      setGrade(g);
      setTab("tests");
      if (g.status === "correct") toast.success("All tests passed! 🎉");
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  async function getHint() {
    if (!question) return;
    setTab("coach");
    if (source === "curated" && curated) {
      setHint(curatedPyHintAt(curated, hintIndex.current));
      hintIndex.current += 1;
      return;
    }
    setCoachBusy(true);
    try {
      setHint(await pythonApi.hint(codeRef.current));
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCoachBusy(false);
    }
  }

  async function explain() {
    setTab("coach");
    setCoachBusy(true);
    try {
      setExplanation(await pythonApi.explain());
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCoachBusy(false);
    }
  }

  async function giveUp() {
    setTab("coach");
    setCoachBusy(true);
    try {
      setSolution(await pythonApi.giveUp());
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setCoachBusy(false);
    }
  }

  // Global ⌘↵ run / ⌘⇧↵ submit, matching SQL practice. Kept in refs so the
  // listener stays attached once while always calling the latest handlers.
  const runFnRef = React.useRef(run);
  runFnRef.current = run;
  const submitFnRef = React.useRef(submit);
  submitFnRef.current = submit;
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key !== "Enter") return;
      if (viewRef.current !== "practice" || !questionRef.current) return;
      const target = e.target as HTMLElement | null;
      // Monaco binds ⌘↵ / ⌘⇧↵ inside the editor — let it handle those itself.
      if (target?.closest(".monaco-editor")) return;
      e.preventDefault();
      if (e.shiftKey) submitFnRef.current();
      else runFnRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selectCls =
    "rounded-md border border-border bg-background px-2 py-1 text-xs capitalize";

  return (
    <div className="flex h-full flex-col">
      {view === "learn" ? (
        <div className="min-h-0 flex-1">
          <SyllabusView syllabus={PY_SYLLABUS} onPracticeConcept={practiceConcept} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
      {/* control bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
          {(["ai", "curated"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors " +
                (source === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {s === "ai" ? "AI" : "Curated"}
            </button>
          ))}
        </div>
        <select value={concept} onChange={(e) => setConcept(e.target.value)} className={selectCls}>
          {concepts.map((c) => (
            <option key={c.concept} value={c.concept}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as PyDifficulty)}
          className={selectCls}
        >
          {DIFFS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Button size="sm" className="h-8 gap-1.5" onClick={newExercise} disabled={loadingNew}>
          {loadingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          New exercise
        </Button>
      </div>

      {!question ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Practice Python with graded exercises — pick a concept and difficulty, then
            <span className="font-medium text-foreground"> New exercise</span>.
          </p>
        </div>
      ) : (
        <PanelGroup orientation={wide ? "horizontal" : "vertical"} className="min-h-0 flex-1">
          <Panel defaultSize="50%" minSize="30%" className="min-h-0">
            <div className="flex h-full flex-col gap-2 p-3">
              <PyPrompt question={question} />
              <div className="min-h-0 flex-1">
                <PyEditor
                  value={code}
                  onChange={setCode}
                  onRun={run}
                  onSubmit={submit}
                  running={running}
                  submitting={submitting}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={getHint}>
                  <Lightbulb className="h-3.5 w-3.5" /> Hint
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={giveUp}>
                  <RotateCcw className="h-3.5 w-3.5" /> Solution
                </Button>
              </div>
            </div>
          </Panel>
          <PanelResizeHandle
            className={wide ? "w-px bg-border hover:bg-primary/40" : "h-px bg-border hover:bg-primary/40"}
          />
          <Panel defaultSize="50%" minSize="25%" className="min-h-0">
            <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col">
              <TabsList className="m-3 mb-0 self-start">
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="tests">Tests</TabsTrigger>
                <TabsTrigger value="coach">Coach</TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <TabsContent value="output" className="mt-0">
                  {runResult ? (
                    <div className="flex flex-col gap-2">
                      {runResult.stdout && (
                        <pre className="whitespace-pre-wrap rounded-md border border-border/60 bg-card/50 p-3 font-mono text-xs">
                          {runResult.stdout}
                        </pre>
                      )}
                      {runResult.stderr && (
                        <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs text-destructive">
                          {runResult.stderr}
                        </pre>
                      )}
                      {!runResult.stdout && !runResult.stderr && (
                        <div className="text-sm text-muted-foreground">No output.</div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {runResult.duration_ms} ms{runResult.sandboxed ? " · sandboxed" : " · UNSANDBOXED"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Press <span className="font-medium">Run</span> (⌘↵) to execute your code.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="tests" className="mt-0">
                  {grade ? (
                    <TestResults grade={grade} />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Press <span className="font-medium">Submit</span> (⌘⇧↵) to run the tests.
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="coach" className="mt-0">
                  <div className="flex flex-col gap-3">
                    {coachBusy && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                      </div>
                    )}
                    {hint && (
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Lightbulb className="h-3.5 w-3.5 text-primary" /> Hint
                        </div>
                        <p className="text-sm">{hint.hint}</p>
                        {hint.suggested_code && (
                          <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">
                            {hint.suggested_code}
                          </pre>
                        )}
                        {source === "curated" && curated && (
                          <button onClick={getHint} className="mt-2 text-xs text-primary hover:underline">
                            Next hint
                          </button>
                        )}
                      </div>
                    )}
                    {source === "ai" && grade && grade.status === "wrong" && (
                      <Button size="sm" variant="outline" className="self-start" onClick={explain}>
                        Explain what went wrong
                      </Button>
                    )}
                    {explanation && (
                      <div className="rounded-lg border border-border bg-card p-3 text-sm">
                        {explanation.explanation}
                      </div>
                    )}
                    {solution && (
                      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                        <div className="text-sm font-medium">Solution</div>
                        {solution.summary && <p className="text-sm text-foreground/90">{solution.summary}</p>}
                        {solution.steps.map((s, i) => (
                          <div key={i} className="border-t border-border/60 pt-2">
                            <div className="text-sm font-medium">{s.title}</div>
                            <p className="text-xs text-muted-foreground">{s.what_it_does}</p>
                            {s.code && (
                              <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">
                                {s.code}
                              </pre>
                            )}
                            <p className="mt-1 text-xs text-foreground/80">{s.how_it_runs}</p>
                          </div>
                        ))}
                        {solution.reference_solution && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">Full reference solution</summary>
                            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono">
                              {solution.reference_solution}
                            </pre>
                          </details>
                        )}
                        {solution.final_thought && (
                          <p className="text-xs italic text-muted-foreground">{solution.final_thought}</p>
                        )}
                      </div>
                    )}
                    {!hint && !explanation && !solution && !coachBusy && (
                      <div className="text-sm text-muted-foreground">
                        Stuck? Use <span className="font-medium">Hint</span> or{" "}
                        <span className="font-medium">Solution</span>.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </Panel>
        </PanelGroup>
      )}
        </div>
      )}
    </div>
  );
}
