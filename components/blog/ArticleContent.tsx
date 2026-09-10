"use client";

import type { ArticleHeading, ArticleNode } from "@/lib/blog/types";
import { CodeEditor } from "@/components/CodeEditor";
import { MathBlock, MathInline } from "@/components/laboratory/MathNode";
import { MermaidDiagram } from "@/components/blog/MermaidDiagram";

export interface ArticleContentProps {
  content: ArticleNode[];
  /** Same array `parse-article.ts` derived from this content — paired up with depth-2/3 headings in document order to assign anchor ids. */
  headings: ArticleHeading[];
}

interface RenderContext {
  headings: ArticleHeading[];
  /** Mutable cursor into `headings`, advanced as depth-2/3 headings are encountered in document order — see module note in `parse-article.ts`'s `collectHeadings`. */
  headingCursor: { index: number };
}

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-8 mb-4 text-2xl font-bold text-slate-900 sm:mt-10 sm:text-3xl",
  2: "mt-8 mb-4 scroll-mt-32 text-xl font-bold text-slate-900 sm:mt-10 sm:text-2xl",
  3: "mt-6 mb-3 scroll-mt-32 text-lg font-semibold text-slate-900 sm:mt-8 sm:text-xl",
  4: "mt-5 mb-2 text-base font-semibold text-slate-900 sm:mt-6 sm:text-lg",
  5: "mt-4 mb-2 text-sm font-semibold text-slate-900 sm:text-base",
  6: "mt-4 mb-2 text-sm font-semibold text-slate-700",
};

/**
 * Renders a parsed `Article.content` tree as read-only article prose —
 * mirrors `components/laboratory/LaboratoryRenderer.tsx`'s node-rendering
 * approach (real React elements per node, never `dangerouslySetInnerHTML`
 * except inside `MathBlock`/`MathInline`, reused as-is).
 */
export function ArticleContent({ content, headings }: ArticleContentProps) {
  const ctx: RenderContext = { headings, headingCursor: { index: 0 } };
  return (
    <div className="article-prose max-w-none text-lg leading-7 text-slate-800 sm:text-xl sm:leading-8">
      {renderNodes(content, ctx)}
    </div>
  );
}

function renderNodes(nodes: ArticleNode[], ctx: RenderContext): React.ReactNode[] {
  return nodes.map((node, index) => renderNode(node, ctx, index));
}

function renderNode(node: ArticleNode, ctx: RenderContext, key: number): React.ReactNode {
  switch (node.type) {
    case "heading": {
      const Tag = `h${node.depth}` as keyof JSX.IntrinsicElements;
      const id = node.depth === 2 || node.depth === 3 ? ctx.headings[ctx.headingCursor.index++]?.id : undefined;
      return (
        <Tag key={key} id={id} className={HEADING_CLASSES[node.depth]}>
          {renderNodes(node.children, ctx)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="mb-5">
          {renderNodes(node.children, ctx)}
        </p>
      );
    case "text":
      return node.value;
    case "strong":
      return <strong key={key}>{renderNodes(node.children, ctx)}</strong>;
    case "emphasis":
      return <em key={key}>{renderNodes(node.children, ctx)}</em>;
    case "delete":
      return <del key={key}>{renderNodes(node.children, ctx)}</del>;
    case "inlineCode":
      return (
        <code key={key} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8em] text-slate-800">
          {node.value}
        </code>
      );
    case "code":
      if (node.lang === "mermaid") {
        return <MermaidDiagram key={key} code={node.value} />;
      }
      return (
        <div key={key} className="article-code my-6 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
          {node.lang && (
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-500 sm:text-sm">
              {node.lang}
            </div>
          )}
          <CodeEditor value={node.value} language={node.lang ?? "text"} readOnly height="auto" />
        </div>
      );
    case "list": {
      const ListTag = node.ordered ? "ol" : "ul";
      return (
        <ListTag key={key} className={`mb-5 space-y-2 pl-6 ${node.ordered ? "list-decimal" : "list-disc"}`}>
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
      return null;
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key} src={node.url} alt={node.alt ?? ""} title={node.title ?? undefined} className="my-6 max-w-full rounded-lg" />
      );
    case "thematicBreak":
      return <hr key={key} className="my-8 border-slate-200" />;
    case "blockquote":
      return (
        <blockquote key={key} className="my-6 border-l-4 border-slate-300 pl-4 italic text-slate-600">
          {renderNodes(node.children, ctx)}
        </blockquote>
      );
    case "link":
      return (
        <a key={key} href={node.url} target="_blank" rel="noreferrer" className="text-brand-700 underline underline-offset-2 hover:text-brand-800">
          {renderNodes(node.children, ctx)}
        </a>
      );
    case "break":
      return <br key={key} />;
    case "math":
      return <MathBlock key={key} value={node.value} />;
    case "inlineMath":
      return <MathInline key={key} value={node.value} />;
    default:
      return null;
  }
}

function renderTable(node: Extract<ArticleNode, { type: "table" }>, ctx: RenderContext, key: number): React.ReactNode {
  const [headerRow, ...bodyRows] = node.children;

  function renderRow(row: ArticleNode, isHeader: boolean, rowKey: number | string): React.ReactNode {
    if (row.type !== "tableRow") return null;
    const CellTag = isHeader ? "th" : "td";
    return (
      <tr key={rowKey}>
        {row.children.map((cell, i) =>
          cell.type === "tableCell" ? (
            <CellTag
              key={i}
              className={`border border-slate-200 px-3 py-2 text-left align-top text-base sm:text-lg ${isHeader ? "bg-slate-50 font-semibold" : ""}`}
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
    <div key={key} className="my-6 overflow-x-auto">
      <table className="w-full border-collapse">
        {headerRow && <thead>{renderRow(headerRow, true, "header")}</thead>}
        <tbody>{bodyRows.map((row, i) => renderRow(row, false, i))}</tbody>
      </table>
    </div>
  );
}
