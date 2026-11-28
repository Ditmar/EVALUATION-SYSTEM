"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { IdeConsole, type ConsoleTab } from "@/components/ide/IdeConsole";
import type { IdeAnswerValue, IdeConfig, RunResult } from "@/lib/code-runner/types";
// Pure modules, safe in the browser: the same name rules the server enforces.
import { validateFileName } from "@/lib/code-runner/files";
import { languageRuntime } from "@/lib/code-runner/languages";

const EMIT_DEBOUNCE_MS = 300;
const CLIENT_RUN_TIMEOUT_MS = 30_000;
const LANGUAGE_LABEL: Record<IdeConfig["language"], string> = { python: "Python", java: "Java", typescript: "TypeScript" };

type EditableFile = { name: string; content: string };

export interface IdeWorkspaceProps {
  config: IdeConfig;
  value: IdeAnswerValue | undefined;
  onChange?: (value: IdeAnswerValue) => void;
  /** POST endpoint of a `/run` route. Absent → no Run button (static preview). */
  runEndpoint?: string;
  /** Sent along with files/stdin; must include `questionId`. */
  runBody?: Record<string, unknown>;
  disabled?: boolean;
  /** Runs already used (server count), for "ejecuciones N/M". */
  initialRunsUsed?: number;
  /** Teacher views: Run stays available even when the student can no longer edit. */
  allowRunWhenDisabled?: boolean;
  /** e.g. `studentFetch` in laboratories (refreshes the 15-min student session on 401). */
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

function starterEditable(config: IdeConfig): EditableFile[] {
  return config.starterFiles.filter((f) => !f.readonly).map(({ name, content }) => ({ name, content }));
}

function sameFiles(a: EditableFile[], b: EditableFile[]): boolean {
  return a.length === b.length && a.every((f, i) => f.name === b[i].name && f.content === b[i].content);
}

/**
 * Mini IDE for `ide` questions: file tabs + CodeMirror + Run + console.
 * Knows nothing about exams or laboratories — the caller provides the run
 * endpoint and persists `onChange` values (debounced here, like CodeAnswer).
 */
export function IdeWorkspace({
  config,
  value,
  onChange,
  runEndpoint,
  runBody,
  disabled,
  initialRunsUsed,
  allowRunWhenDisabled,
  fetcher = fetch,
}: IdeWorkspaceProps) {
  const readonlyFiles = config.starterFiles.filter((f) => f.readonly);
  const external: EditableFile[] = value?.files?.length ? value.files : starterEditable(config);
  const externalStdin = value?.stdin ?? config.stdin;

  const [files, setFiles] = useState<EditableFile[]>(external);
  const [stdin, setStdin] = useState(externalStdin);
  const [active, setActive] = useState(config.entry);
  const [mounted, setMounted] = useState<Set<string>>(() => new Set([config.entry]));
  const [editingName, setEditingName] = useState<{ original: string | null; draft: string; error?: string } | null>(null);
  // Two-click confirmation instead of window.confirm: a native dialog blurs the
  // window, which the exam's anti-cheat monitor would count as an incident.
  const [confirming, setConfirming] = useState<string | null>(null);

  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("output");
  const [runsUsed, setRunsUsed] = useState(initialRunsUsed ?? 0);

  // ----- debounced emit (same pattern as CodeAnswer) -----
  const filesRef = useRef(files);
  const stdinRef = useRef(stdin);
  const lastEmitted = useRef<{ files: EditableFile[]; stdin: string }>({ files: external, stdin: externalStdin });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!sameFiles(external, lastEmitted.current.files) || externalStdin !== lastEmitted.current.stdin) {
      lastEmitted.current = { files: external, stdin: externalStdin };
      filesRef.current = external;
      stdinRef.current = externalStdin;
      setFiles(external);
      setStdin(externalStdin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(external), externalStdin]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = { files: filesRef.current, stdin: stdinRef.current };
    if (!sameFiles(next.files, lastEmitted.current.files) || next.stdin !== lastEmitted.current.stdin) {
      lastEmitted.current = next;
      onChangeRef.current?.({ files: next.files, ...(config.stdinEditable ? { stdin: next.stdin } : {}) });
    }
  }, [config.stdinEditable]);

  useEffect(() => () => flush(), [flush]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, EMIT_DEBOUNCE_MS);
  }, [flush]);

  function updateFiles(next: EditableFile[]) {
    filesRef.current = next;
    setFiles(next);
    schedule();
  }

  function updateContent(name: string, content: string) {
    updateFiles(filesRef.current.map((f) => (f.name === name ? { ...f, content } : f)));
  }

  function updateStdin(next: string) {
    stdinRef.current = next;
    setStdin(next);
    schedule();
  }

  // ----- persisted last run (survives a refresh) -----
  const storageKey = runEndpoint ? `ide-run:${runEndpoint}:${String(runBody?.questionId ?? "")}` : null;
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setResult(JSON.parse(saved) as RunResult);
    } catch {
      // sessionStorage unavailable: just start with an empty console
    }
  }, [storageKey]);

  // ----- run -----
  const canRun = Boolean(runEndpoint) && config.runEnabled && (!disabled || allowRunWhenDisabled);
  const limitReached = config.runLimit !== undefined && runsUsed >= config.runLimit && !allowRunWhenDisabled;

  const run = useCallback(async () => {
    if (!runEndpoint || running) return;
    flush();
    setRunning(true);
    setRunError(null);
    setConsoleTab("output");
    try {
      const res = await fetcher(runEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...runBody, files: filesRef.current, stdin: stdinRef.current }),
        signal: AbortSignal.timeout(CLIENT_RUN_TIMEOUT_MS),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResult(null);
        setRunError(data?.error ?? `No se pudo ejecutar (HTTP ${res.status}).`);
        return;
      }
      const runResult = data as RunResult;
      setResult(runResult);
      if (runResult.runsUsed !== undefined) setRunsUsed(runResult.runsUsed);
      else setRunsUsed((n) => n + 1);
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(runResult));
        } catch {
          // quota exceeded: not important
        }
      }
    } catch (e) {
      setResult(null);
      setRunError(
        (e as Error).name === "TimeoutError" ? "El servidor de ejecución no respondió. Intente de nuevo." : "Error de conexión al ejecutar."
      );
    } finally {
      setRunning(false);
    }
  }, [runEndpoint, runBody, running, flush, storageKey, fetcher]);

  // ----- file management (mode="multi" + allowNewFiles) -----
  const canManageFiles = config.mode === "multi" && config.allowNewFiles && !disabled;
  const allNames = [...files.map((f) => f.name), ...readonlyFiles.map((f) => f.name)];

  const runtime = languageRuntime(config.language);

  function validateNewName(name: string, original: string | null): string | null {
    if (validateFileName(name, config)) {
      return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name) && !name.includes("..")
        ? `Use extensión ${runtime.sourceExt}.`
        : "Nombre inválido (sin espacios ni carpetas).";
    }
    if (allNames.some((n) => n.toLowerCase() === name.toLowerCase() && n !== original)) return "Ya existe un archivo con ese nombre.";
    if (original === null && allNames.length >= config.maxFiles) return `Máximo ${config.maxFiles} archivos.`;
    return null;
  }

  function commitName() {
    if (!editingName) return;
    const name = editingName.draft.trim();
    if (editingName.original !== null && name === editingName.original) {
      setEditingName(null);
      return;
    }
    const error = validateNewName(name, editingName.original);
    if (error) {
      setEditingName({ ...editingName, error });
      return;
    }
    if (editingName.original === null) {
      updateFiles([...filesRef.current, { name, content: "" }]);
    } else {
      const original = editingName.original;
      updateFiles(filesRef.current.map((f) => (f.name === original ? { ...f, name } : f)));
      setMounted((m) => new Set([...m].filter((n) => n !== original)));
    }
    setMounted((m) => new Set(m).add(name));
    setActive(name);
    setEditingName(null);
  }

  function deleteFile(name: string) {
    if (confirming !== `delete:${name}`) {
      setConfirming(`delete:${name}`);
      return;
    }
    setConfirming(null);
    updateFiles(filesRef.current.filter((f) => f.name !== name));
    if (active === name) setActive(config.entry);
  }

  function restoreTemplate() {
    if (confirming !== "restore") {
      setConfirming("restore");
      return;
    }
    setConfirming(null);
    const starter = starterEditable(config);
    updateFiles(starter);
    setMounted(new Set([config.entry]));
    setActive(config.entry);
  }

  function openTab(name: string) {
    setActive(name);
    setMounted((m) => (m.has(name) ? m : new Set(m).add(name)));
  }

  const tabs: { name: string; readonly: boolean }[] = [
    ...files.map((f) => ({ name: f.name, readonly: false })),
    ...readonlyFiles.map((f) => ({ name: f.name, readonly: true })),
  ];
  const showTabs = tabs.length > 1 || canManageFiles;
  const editorHeight = `${config.height}px`;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white" onBlur={flush}>
      {showTabs && (
        <div className="flex items-stretch overflow-x-auto border-b border-slate-200 bg-slate-50 text-xs" role="tablist">
          {tabs.map((tab) =>
            editingName?.original === tab.name ? (
              <FileNameInput key={tab.name} state={editingName} onChange={setEditingName} onCommit={commitName} />
            ) : (
              <div
                key={tab.name}
                className={`group flex shrink-0 items-center gap-1 border-r border-slate-200 px-3 py-1.5 ${
                  active === tab.name ? "bg-white font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active === tab.name}
                  onClick={() => openTab(tab.name)}
                  onDoubleClick={() => {
                    if (canManageFiles && !tab.readonly && tab.name !== config.entry) setEditingName({ original: tab.name, draft: tab.name });
                  }}
                  title={tab.name === config.entry ? "Archivo principal (se ejecuta)" : tab.readonly ? "Solo lectura" : canManageFiles ? "Doble clic para renombrar" : undefined}
                >
                  {tab.name === config.entry && <span className="mr-1 text-emerald-600">▶</span>}
                  {tab.readonly && <span className="mr-1">🔒</span>}
                  {tab.name}
                </button>
                {canManageFiles && !tab.readonly && tab.name !== config.entry && (
                  <button
                    type="button"
                    className={`ml-1 hover:text-red-600 ${
                      confirming === `delete:${tab.name}` ? "font-medium text-red-600" : "text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    }`}
                    onClick={() => deleteFile(tab.name)}
                    onBlur={() => setConfirming(null)}
                    aria-label={`Eliminar ${tab.name}`}
                  >
                    {confirming === `delete:${tab.name}` ? "¿Eliminar?" : "×"}
                  </button>
                )}
              </div>
            )
          )}
          {canManageFiles &&
            (editingName?.original === null ? (
              <FileNameInput state={editingName} onChange={setEditingName} onCommit={commitName} />
            ) : (
              <button
                type="button"
                className="shrink-0 px-3 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setEditingName({ original: null, draft: `Nuevo${runtime.sourceExt}` })}
                title="Nuevo archivo"
              >
                + Archivo
              </button>
            ))}
        </div>
      )}

      <div>
        {files.map((file) =>
          mounted.has(file.name) ? (
            <div key={file.name} hidden={active !== file.name}>
              <CodeEditor
                value={file.content}
                language={config.language}
                onChange={(next) => updateContent(file.name, next)}
                readOnly={disabled}
                height={editorHeight}
                ideMode
                onRun={canRun && !limitReached ? run : undefined}
                autocomplete={config.autocomplete}
              />
            </div>
          ) : null
        )}
        {readonlyFiles.map((file) =>
          active === file.name ? (
            <div key={file.name}>
              <CodeEditor value={file.content} language={config.language} readOnly height={editorHeight} ideMode />
            </div>
          ) : null
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {canRun && (
          <button
            type="button"
            onClick={run}
            disabled={running || limitReached}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Ctrl+Enter"
          >
            {running ? "Ejecutando…" : "▶ Run"}
            <span className="hidden text-[10px] font-normal opacity-80 sm:inline">Ctrl+Enter</span>
          </button>
        )}
        <span>
          {LANGUAGE_LABEL[config.language]}
          {result?.version ? ` ${result.version}` : ""}
        </span>
        {config.runLimit !== undefined && canRun && (
          <span className={limitReached ? "font-medium text-red-600" : ""}>
            ejecuciones {runsUsed}/{config.runLimit}
          </span>
        )}
        {!disabled && config.starterFiles.length > 0 && (
          <button
            type="button"
            className={`ml-auto underline-offset-2 hover:underline ${confirming === "restore" ? "font-medium text-red-600" : "text-slate-500 hover:text-slate-900"}`}
            onClick={restoreTemplate}
            onBlur={() => setConfirming(null)}
          >
            {confirming === "restore" ? "¿Seguro? Se perderán sus cambios" : "Restaurar plantilla"}
          </button>
        )}
      </div>

      {(canRun || config.stdin) && (
        <IdeConsole
          tab={consoleTab}
          onTabChange={setConsoleTab}
          result={result}
          error={runError}
          running={running}
          command={runtime.command(config.entry)}
          stdin={stdin}
          onStdinChange={disabled ? undefined : updateStdin}
          stdinEditable={config.stdinEditable}
          onClear={() => {
            setResult(null);
            setRunError(null);
            if (storageKey) sessionStorage.removeItem(storageKey);
          }}
        />
      )}
    </div>
  );
}

function FileNameInput({
  state,
  onChange,
  onCommit,
}: {
  state: { original: string | null; draft: string; error?: string };
  onChange: (s: { original: string | null; draft: string; error?: string } | null) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-r border-slate-200 bg-white px-2 py-1">
      <input
        autoFocus
        className={`w-36 rounded border px-1 py-0.5 font-mono text-xs outline-none ${state.error ? "border-red-400" : "border-slate-300"}`}
        value={state.draft}
        onChange={(e) => onChange({ ...state, draft: e.target.value, error: undefined })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Escape") {
            onChange(null);
          }
        }}
        onBlur={onCommit}
        aria-label="Nombre del archivo"
      />
      {state.error && <span className="text-[11px] text-red-600">{state.error}</span>}
    </div>
  );
}
