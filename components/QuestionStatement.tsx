"use client";

import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { extensionsFor } from "@/components/CodeEditor";
import { parseStatement } from "@/lib/statement";

export function QuestionStatement({ statement, className = "" }: { statement: string; className?: string }) {
  const segments = parseStatement(statement);

  return (
    <div className={className}>
      {segments.map((segment, index) =>
        segment.type === "code" ? (
          <div key={index} className="my-2 overflow-hidden rounded-lg border border-slate-200 text-sm">
            <CodeMirror
              value={segment.content}
              theme="light"
              editable={false}
              extensions={[...extensionsFor(segment.language), EditorView.lineWrapping]}
              basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
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
}
