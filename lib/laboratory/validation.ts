import type { LaboratoryMetadata, LaboratoryParseError, LaboratoryParseWarning, QuestionDefinition, RubricDefinition } from "./types";

/** Every `{{rubric for="..."}}` must point at a question id that actually exists. */
export function validateRubricReferences(rubrics: RubricDefinition[], questions: QuestionDefinition[]): LaboratoryParseError[] {
  const questionIds = new Set(questions.map((q) => q.id));
  return rubrics
    .filter((r) => !questionIds.has(r.for))
    .map((r) => ({ message: `Rubric references unknown question "${r.for}".` }));
}

/**
 * The sum of question points doesn't have to match the frontmatter's
 * declared `points` exactly, but a mismatch is very likely an authoring
 * mistake worth flagging — surfaced as a warning, never a blocking error.
 */
export function checkPointsTotal(questions: QuestionDefinition[], metadata: LaboratoryMetadata): LaboratoryParseWarning[] {
  if (metadata.points === undefined) return [];
  const total = questions.reduce((sum, q) => sum + q.points, 0);
  if (total !== metadata.points) {
    return [
      {
        message: `La suma de puntos de las preguntas (${total}) no coincide con "points" del frontmatter (${metadata.points}).`,
      },
    ];
  }
  return [];
}
