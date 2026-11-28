"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { StreamLanguage } from "@codemirror/language";
import { c, cpp, csharp } from "@codemirror/legacy-modes/mode/clike";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { indentWithTab } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";

function computeExtensionsFor(language: string): Extension[] {
  switch (language) {
    case "typescript":
    case "ts":
      return [javascript({ typescript: true })];
    // First-class Lezer grammars (accurate indentation, folding, bracket matching).
    case "java":
      return [java()];
    case "python":
    case "py":
      return [python()];
    case "c":
      return [StreamLanguage.define(c)];
    case "cpp":
    case "c++":
      return [StreamLanguage.define(cpp)];
    case "csharp":
    case "c#":
      return [StreamLanguage.define(csharp)];
    case "bash":
    case "sh":
    case "shell":
      return [StreamLanguage.define(shell)];
    case "markdown":
    case "md":
    case "text":
    case "txt":
    case "plain":
      // No dedicated markdown mode installed; better to show plain,
      // unstyled text than to miscolor prose using JS syntax rules.
      return [];
    case "javascript":
    case "js":
    default:
      return [javascript({ typescript: false })];
  }
}

const extensionsCache = new Map<string, Extension[]>();

/**
 * Cached by language: `@uiw/react-codemirror` reconfigures the whole editor
 * (a full re-highlight) whenever the `extensions` array it receives has a new
 * reference, even if its contents are equivalent — see its `useCodeMirror`
 * reconfigure effect. Every render used to build a fresh array here, so
 * typing in any one field on a page with several code blocks (e.g. a
 * laboratory's statement plus a student's answer) forced every other
 * CodeMirror instance to fully reconfigure on every keystroke, which got
 * progressively laggier the more/larger the code blocks were.
 */
export function extensionsFor(language: string): Extension[] {
  let cached = extensionsCache.get(language);
  if (!cached) {
    cached = [...computeExtensionsFor(language), EditorView.lineWrapping];
    extensionsCache.set(language, cached);
  }
  return cached;
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
  /**
   * IDE mode (the `ide` question type): Tab indents instead of moving focus
   * (Esc, then Tab, leaves the editor) and Ctrl/Cmd+Enter calls `onRun`.
   */
  onRun?: () => void;
  ideMode?: boolean;
  /** Off by default: in an evaluation, completions would be hints. */
  autocomplete?: boolean;
}

function ideExtensionsFor(language: string, runRef: { current: (() => void) | undefined }): Extension[] {
  // The run keymap reads the latest callback through a ref, so the returned
  // array can stay referentially stable for the editor's whole lifetime
  // (see the reconfigure note on `extensionsFor`).
  return [
    ...extensionsFor(language),
    keymap.of([indentWithTab]),
    Prec.highest(
      keymap.of([
        {
          key: "Mod-Enter",
          preventDefault: true,
          run: () => {
            runRef.current?.();
            return true;
          },
        },
      ])
    ),
  ];
}

// memo: read-only statement code blocks keep identical props across keystrokes elsewhere.
export const CodeEditor = memo(function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = "300px",
  onRun,
  ideMode = false,
  autocomplete,
}: CodeEditorProps) {
  const runRef = useRef(onRun);
  runRef.current = onRun;
  const extensions = useMemo(
    () => (ideMode ? ideExtensionsFor(language, runRef) : extensionsFor(language)),
    [ideMode, language]
  );

  // @uiw/react-codemirror reconfigures the whole editor (full re-highlight)
  // whenever the *identity* of `onChange` or `basicSetup` changes — see its
  // reconfigure effect. Callers often pass inline arrows, and an inline
  // `basicSetup` object is new on every render, so every parent re-render
  // (e.g. each keystroke anywhere in an exam) used to reconfigure every editor
  // on the page. Keep both referentially stable.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const stableOnChange = useCallback((next: string) => onChangeRef.current?.(next), []);
  const basicSetup = useMemo(
    () => ({
      lineNumbers: true,
      foldGutter: true,
      // Keep the existing behavior for plain `code` questions; IDE questions opt in explicitly.
      ...(ideMode ? { autocompletion: Boolean(autocomplete), tabSize: 4 } : {}),
    }),
    [ideMode, autocomplete]
  );

  return (
    <CodeMirror
      value={value}
      height={height}
      theme="light"
      extensions={extensions}
      editable={!readOnly}
      onChange={onChange ? stableOnChange : undefined}
      basicSetup={basicSetup}
    />
  );
});
