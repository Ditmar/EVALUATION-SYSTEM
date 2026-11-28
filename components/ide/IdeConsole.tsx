"use client";

import type { RunResult } from "@/lib/code-runner/types";

export type ConsoleTab = "output" | "stdin";

const STATUS_MESSAGES: Record<RunResult["status"], string | null> = {
  ok: null,
  runtime_error: "El programa terminó con error.",
  compile_error: "Error de compilación.",
  timeout: "Tiempo límite excedido. ¿Hay un bucle infinito o una lectura de stdin sin datos?",
  memory: "Memoria límite excedida.",
  unavailable: "El servidor de ejecución no está disponible.",
};

interface IdeConsoleProps {
  tab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  result: RunResult | null;
  error: string | null;
  running: boolean;
  command: string;
  stdin: string;
  onStdinChange?: (value: string) => void;
  stdinEditable: boolean;
  onClear: () => void;
}

/**
 * Output is plain text in a `<pre>` — React escapes it; it is never parsed as
 * HTML (a program can print anything, including `<script>`).
 */
export function IdeConsole({ tab, onTabChange, result, error, running, command, stdin, onStdinChange, stdinEditable, onClear }: IdeConsoleProps) {
  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium ${active ? "border-b-2 border-emerald-400 text-white" : "text-slate-400 hover:text-slate-200"}`;

  return (
    <div className="flex flex-col border-t border-slate-700 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 px-1">
        <div className="flex" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "output"} className={tabClass(tab === "output")} onClick={() => onTabChange("output")}>
            Salida
          </button>
          <button type="button" role="tab" aria-selected={tab === "stdin"} className={tabClass(tab === "stdin")} onClick={() => onTabChange("stdin")}>
            Entrada (stdin){stdin ? " •" : ""}
          </button>
        </div>
        {tab === "output" && (
          <button type="button" className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200" onClick={onClear}>
            Limpiar
          </button>
        )}
      </div>

      {tab === "stdin" ? (
        <textarea
          className="h-40 resize-y bg-slate-900 p-3 font-mono text-xs text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60"
          value={stdin}
          onChange={(e) => onStdinChange?.(e.target.value)}
          disabled={!stdinEditable || !onStdinChange}
          placeholder={stdinEditable ? "Escriba aquí la entrada que leerá el programa (se envía completa al presionar Run)." : "Esta pregunta usa una entrada fija."}
          spellCheck={false}
        />
      ) : (
        <pre className="h-40 min-h-[7.5rem] resize-y overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed" aria-live="polite">
          {running && <span className="text-slate-400">Ejecutando…{"\n"}</span>}
          {!running && !result && !error && <span className="text-slate-500">Presione Run (Ctrl+Enter) para ejecutar su código.</span>}
          {!running && error && <span className="text-red-400">{error}</span>}
          {!running && result && (
            <>
              <span className="text-slate-500">$ {command}{"\n"}</span>
              {result.compile && <span className="text-amber-300">{result.compile.output}{"\n"}</span>}
              {result.stdout}
              {result.stderr && <span className="text-red-400">{result.stderr}</span>}
              {result.truncated && <span className="text-amber-300">{"\n"}… salida truncada</span>}
              {"\n"}
              <span className={result.status === "ok" ? "text-emerald-400" : "text-red-400"}>
                {"── "}
                {STATUS_MESSAGES[result.status] ? `${STATUS_MESSAGES[result.status]} · ` : ""}
                {result.exitCode !== null ? `exit ${result.exitCode}` : result.signal ?? ""}
                {` · ${result.durationMs} ms`}
              </span>
            </>
          )}
        </pre>
      )}
    </div>
  );
}
