"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { c, clike, cpp, csharp } from "@codemirror/legacy-modes/mode/clike";
import { python } from "@codemirror/legacy-modes/mode/python";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

// Minimal keyword set sufficient for readable Java syntax highlighting via the
// generic C-like legacy mode (there is no first-class CM6 Java language package).
const JAVA_KEYWORDS = wordsToObject(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits yield"
);

function wordsToObject(words: string): Record<string, boolean> {
  return Object.fromEntries(words.split(" ").map((w) => [w, true]));
}

function computeExtensionsFor(language: string): Extension[] {
  switch (language) {
    case "typescript":
    case "ts":
      return [javascript({ typescript: true })];
    case "java":
      return [StreamLanguage.define(clike({ name: "java", keywords: JAVA_KEYWORDS }))];
    case "python":
    case "py":
      return [StreamLanguage.define(python)];
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
}

export function CodeEditor({ value, onChange, language, readOnly = false, height = "300px" }: CodeEditorProps) {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme="light"
      extensions={extensionsFor(language)}
      editable={!readOnly}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: true }}
    />
  );
}
