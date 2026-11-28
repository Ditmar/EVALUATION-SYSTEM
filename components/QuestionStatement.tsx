"use client";

import { memo, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { extensionsFor } from "@/components/CodeEditor";
import { parseStatement } from "@/lib/statement";

// Module-level constant on purpose: @uiw/react-codemirror reconfigures (fully
// re-highlights) an editor whenever `basicSetup` changes identity, and an
// inline object literal is a new identity on every render.
const STATEMENT_BASIC_SETUP = { lineNumbers: false, foldGutter: false, highlightActiveLine: false };

// memo: the statement never changes while the student types in an answer, but
// the exam page re-renders on every keystroke/autosave status change.
export const QuestionStatement = memo(function QuestionStatement({ statement, className = "" }: { statement: string; className?: string }) {
  const segments = useMemo(() => parseStatement(statement), [statement]);

  return (
    <div className={className}>
      {segments.map((segment, index) =>
        segment.type === "code" ? (
          <div key={index} className="my-2 overflow-hidden rounded-lg border border-slate-200 text-sm">
            <CodeMirror
              value={segment.content}
              theme="light"
              editable={false}
              extensions={extensionsFor(segment.language)}
              basicSetup={STATEMENT_BASIC_SETUP}
            />
          </div>
        ) : (
          <p key={index} className="whitespace-pre-wrap text-slate-700">
            {segment.content.trim()}
          </p>
        )
      )}
    </div>
  );
});
