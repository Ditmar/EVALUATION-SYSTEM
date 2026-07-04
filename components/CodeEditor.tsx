"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { clike } from "@codemirror/legacy-modes/mode/clike";
import { EditorView } from "@codemirror/view";

function extensionsFor(language: string) {
  switch (language) {
    case "typescript":
      return [javascript({ typescript: true })];
    case "java":
      return [StreamLanguage.define(clike({ name: "java", keywords: JAVA_KEYWORDS }))];
    case "javascript":
    default:
      return [javascript({ typescript: false })];
  }
}

// Minimal keyword set sufficient for readable Java syntax highlighting via the
// generic C-like legacy mode (there is no first-class CM6 Java language package).
const JAVA_KEYWORDS = wordsToObject(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed permits yield"
);

function wordsToObject(words: string): Record<string, boolean> {
  return Object.fromEntries(words.split(" ").map((w) => [w, true]));
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
      extensions={[...extensionsFor(language), EditorView.lineWrapping]}
      editable={!readOnly}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: true }}
    />
  );
}
