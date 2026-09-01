"use client";

import type { AnswerValue, LaboratoryNode, QuestionDefinition, RepositoryResource } from "@/lib/laboratory/types";
import { CodeEditor } from "@/components/CodeEditor";
import { answerRegistry } from "./answers/registry";
import type { GithubAttemptSummary } from "./answers/types";

export interface LaboratoryRendererProps {
  content: LaboratoryNode[];
  questions: QuestionDefinition[];
  answers: Record<string, AnswerValue>;
  onAnswerChange?: (questionId: string, value: AnswerValue) => void;
  disabled?: boolean;
  /** Needed only by `github-pr` questions, to build their request URLs — a no-op for every other type. */
  labId?: string;
  repositories?: RepositoryResource[];
  githubAttempts?: Record<string, GithubAttemptSummary>;
}

interface RenderContext {
  questionsById: Map<string, QuestionDefinition>;
  repositoriesById: Map<string, RepositoryResource>;
  answers: Record<string, AnswerValue>;
  onAnswerChange?: (questionId: string, value: AnswerValue) => void;
  disabled?: boolean;
  labId?: string;
  githubAttempts?: Record<string, GithubAttemptSummary>;
}

const HEADING_CLASSES: Record<number, string> = {
  1: "text-2xl font-semibold text-slate-900",
  2: "text-xl font-semibold text-slate-900",
  3: "text-lg font-semibold text-slate-900",
  4: "text-base font-semibold text-slate-900",
  5: "text-sm font-semibold text-slate-900",
  6: "text-sm font-medium text-slate-700",
};

/**
 * Renders a parsed `LaboratoryDefinition.content` tree as a live interactive
 * form. This is the only piece of the module that knows how to turn a
 * `LaboratoryNode` into JSX — it has no idea how anything is graded (that's
 * `lib/laboratory/evaluation/engine.ts`'s job) and never touches Markdown
 * text directly (that's the parser's job).
 *
 * Every node-rendering function takes an explicit `key` and applies it to the
 * single element it returns (rather than wrapping children in an extra
 * `<span>` per node) — table rows/cells and list items require a strict
 * parent/child element structure, and an extra wrapper there would be
 * reparented or dropped by the browser's HTML parser.
 */
export function LaboratoryRenderer({
  content,
  questions,
  answers,
  onAnswerChange,
  disabled,
  labId,
  repositories = [],
  githubAttempts,
}: LaboratoryRendererProps) {
  const ctx: RenderContext = {
    questionsById: new Map(questions.map((q) => [q.id, q])),
    repositoriesById: new Map(repositories.map((r) => [r.id, r])),
    answers,
    onAnswerChange,
    disabled,
    labId,
    githubAttempts,
  };

  return <div className="laboratory-content space-y-4">{renderNodes(content, ctx)}</div>;
}

/** Returns the question id when `children` is just one `labAnswer` (ignoring pure-whitespace text around it), else `null`. */
function getSoleAnswerId(children: LaboratoryNode[]): string | null {
  const meaningful = children.filter((c) => !(c.type === "text" && c.value.trim() === ""));
  return meaningful.length === 1 && meaningful[0].type === "labAnswer" ? meaningful[0].questionId : null;
}

function renderNodes(nodes: LaboratoryNode[], ctx: RenderContext): React.ReactNode[] {
  return nodes.map((node, index) => renderNode(node, ctx, index));
}

function renderNode(node: LaboratoryNode, ctx: RenderContext, key: number): React.ReactNode {
  switch (node.type) {
    case "heading": {
      const Tag = `h${node.depth}` as keyof JSX.IntrinsicElements;
      return (
        <Tag key={key} className={HEADING_CLASSES[node.depth]}>
          {renderNodes(node.children, ctx)}
        </Tag>
      );
    }
    case "paragraph": {
      // A paragraph consisting solely of one `{{answer}}` placeholder (the
      // normal way to write one — on its own line) renders the answer
      // directly, without a `<p>` wrapper: some answer types (`github-pr`)
      // render their own block-level markup, and a block element nested
      // inside a `<p>` is invalid HTML that the browser silently reparents,
      // breaking layout and causing a hydration mismatch.
      const soleAnswerId = getSoleAnswerId(node.children);
      if (soleAnswerId) {
        return renderAnswer(soleAnswerId, ctx, key);
      }
      return (
        <p key={key} className="leading-relaxed text-slate-700">
          {renderNodes(node.children, ctx)}
        </p>
      );
    }
    case "text":
      return node.value;
    case "strong":
      return <strong key={key}>{renderNodes(node.children, ctx)}</strong>;
    case "emphasis":
      return <em key={key}>{renderNodes(node.children, ctx)}</em>;
    case "inlineCode":
      return (
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">
          {node.value}
        </code>
      );
    case "code":
      return (
        <div key={key} className="overflow-hidden rounded-lg border border-slate-200 text-sm">
          <CodeEditor value={node.value} language={node.lang ?? "text"} readOnly height="auto" />
        </div>
      );
    case "list": {
      const ListTag = node.ordered ? "ol" : "ul";
      return (
        <ListTag key={key} className={`space-y-1 pl-5 ${node.ordered ? "list-decimal" : "list-disc"}`}>
          {renderNodes(node.children, ctx)}
        </ListTag>
      );
    }
    case "listItem":
      return <li key={key}>{renderNodes(node.children, ctx)}</li>;
    case "table":
      return renderTable(node, ctx, key);
    case "tableRow":
    case "tableCell":
      // Only reached if a table is malformed enough to fall outside
      // `renderTable`'s explicit header/body split — defensively no-op.
      return null;
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key} src={node.url} alt={node.alt ?? ""} title={node.title ?? undefined} className="max-w-full rounded-lg" />
      );
    case "thematicBreak":
      return <hr key={key} className="border-slate-200" />;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-slate-200 pl-4 italic text-slate-600">
          {renderNodes(node.children, ctx)}
        </blockquote>
      );
    case "link":
      return (
        <a key={key} href={node.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
          {renderNodes(node.children, ctx)}
        </a>
      );
    case "break":
      return <br key={key} />;
    case "labAnswer":
      return renderAnswer(node.questionId, ctx, key);
    default:
      return null;
  }
}

function renderTable(node: Extract<LaboratoryNode, { type: "table" }>, ctx: RenderContext, key: number): React.ReactNode {
  const [headerRow, ...bodyRows] = node.children;

  function renderRow(row: LaboratoryNode, isHeader: boolean, rowKey: number | string): React.ReactNode {
    if (row.type !== "tableRow") return null;
    const CellTag = isHeader ? "th" : "td";
    return (
      <tr key={rowKey}>
        {row.children.map((cell, i) =>
          cell.type === "tableCell" ? (
            <CellTag
              key={i}
              className={`border border-slate-200 px-3 py-2 text-left align-top ${isHeader ? "bg-slate-50 font-medium" : ""}`}
              style={node.align[i] ? { textAlign: node.align[i] as "left" | "right" | "center" } : undefined}
            >
              {renderNodes(cell.children, ctx)}
            </CellTag>
          ) : null
        )}
      </tr>
    );
  }

  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {headerRow && <thead>{renderRow(headerRow, true, "header")}</thead>}
        <tbody>{bodyRows.map((row, i) => renderRow(row, false, i))}</tbody>
      </table>
    </div>
  );
}

function renderAnswer(questionId: string, ctx: RenderContext, key: number): React.ReactNode {
  const question = ctx.questionsById.get(questionId);
  if (!question) {
    return (
      <span key={key} className="text-sm text-red-600">
        [pregunta &quot;{questionId}&quot; no encontrada]
      </span>
    );
  }

  const AnswerComponent = answerRegistry[question.type];
  const value = ctx.answers[questionId];
  const caption = (
    <span className="text-xs text-slate-400">
      {question.points} {question.points === 1 ? "punto" : "puntos"}
      {!question.required && " · opcional"}
    </span>
  );

  const answerElement = (
    <AnswerComponent
      question={question}
      value={value}
      onChange={(next) => ctx.onAnswerChange?.(questionId, next)}
      disabled={ctx.disabled}
      labId={ctx.labId}
      githubAttempt={ctx.githubAttempts?.[questionId]}
      repository={question.type === "github-pr" ? ctx.repositoriesById.get(question.source) : undefined}
    />
  );

  // `github-pr` renders its own full-width block (repo link, URL input,
  // checklist) — the narrow inline-flex span every other answer type uses
  // would cramp it to shrink-to-fit sizing instead of the page's width.
  if (question.type === "github-pr") {
    return (
      <div key={key} className="my-2 space-y-1">
        {answerElement}
        {caption}
      </div>
    );
  }

  return (
    <span key={key} className="my-1 inline-flex min-w-[16rem] flex-col gap-1 align-top">
      {answerElement}
      {caption}
    </span>
  );
}
