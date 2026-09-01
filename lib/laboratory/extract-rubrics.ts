import type { RubricDefinition } from "./types";

const RUBRIC_BLOCK = /\{\{rubric\s+for="([^"]*)"\s*\}\}([\s\S]*?)\{\{\/rubric\}\}/g;

/**
 * Pulls every `{{rubric for="..."}}...{{/rubric}}` block out of the raw
 * Markdown source, before Markdown parsing even begins — rubric bodies often
 * span multiple blocks (a paragraph plus a list), which would be awkward to
 * reconstruct after the fact from a parsed mdast tree. Rubric text is teacher
 * material and must never end up in the student-facing content, so it's
 * stripped from the source here rather than merely hidden by the renderer.
 */
export function extractRubrics(source: string): { source: string; rubrics: RubricDefinition[] } {
  const rubrics: RubricDefinition[] = [];

  const stripped = source.replace(RUBRIC_BLOCK, (_match, forId: string, content: string) => {
    rubrics.push({ for: forId.trim(), content: content.trim() });
    return "";
  });

  return { source: stripped, rubrics };
}
