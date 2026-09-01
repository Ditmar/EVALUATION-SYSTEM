import {
  EVALUATOR_KINDS,
  QUESTION_TYPES,
  type EvaluatorKind,
  type LaboratoryParseError,
  type QuestionDefinition,
  type QuestionType,
} from "./types";

/** Matches `key="value"` pairs; values don't support escaped quotes in v0.1. */
const ATTRIBUTE_PAIR = /([a-zA-Z][\w-]*)\s*=\s*"([^"]*)"/g;

export function parsePlaceholderAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(ATTRIBUTE_PAIR)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function splitPipeList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseBooleanAttr(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

function parseNumberAttr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

export type PlaceholderParseResult = { question: QuestionDefinition } | { errors: LaboratoryParseError[] };

/**
 * Turns one `{{answer ...}}` placeholder's raw string attributes into a typed
 * `QuestionDefinition`. Pure — no Markdown/DOM/DB knowledge. Collects
 * descriptive errors instead of throwing so the caller can report every
 * problem in a document at once rather than stopping at the first one.
 */
export function parsePlaceholder(attrs: Record<string, string>): PlaceholderParseResult {
  const id = attrs.id?.trim();
  if (!id) {
    return { errors: [{ message: 'Se encontró un placeholder "answer" sin atributo "id" obligatorio.' }] };
  }

  const typeAttr = attrs.type?.trim();
  if (!typeAttr || !(QUESTION_TYPES as readonly string[]).includes(typeAttr)) {
    return {
      errors: [
        {
          questionId: id,
          message: `Question "${id}" tiene type="${typeAttr ?? ""}" inválido. Tipos soportados: ${QUESTION_TYPES.join(", ")}.`,
        },
      ],
    };
  }
  const type = typeAttr as QuestionType;

  const points = parseNumberAttr(attrs.points);
  if (points === undefined || points < 0) {
    return { errors: [{ questionId: id, message: `Question "${id}" debe definir "points" como un número mayor o igual a 0.` }] };
  }

  const evaluatorAttr = attrs.evaluator?.trim();
  if (evaluatorAttr && !(EVALUATOR_KINDS as readonly string[]).includes(evaluatorAttr)) {
    return {
      errors: [
        {
          questionId: id,
          message: `Question "${id}" tiene evaluator="${evaluatorAttr}" inválido. Valores válidos: ${EVALUATOR_KINDS.join(", ")}.`,
        },
      ],
    };
  }
  const evaluatorExplicit = evaluatorAttr as EvaluatorKind | undefined;

  const base = {
    id,
    points,
    required: parseBooleanAttr(attrs.required, true),
    placeholder: attrs.placeholder,
  };

  switch (type) {
    case "text": {
      const correct = attrs.correct;
      return { question: { ...base, type, correct, evaluator: evaluatorExplicit ?? (correct !== undefined ? "automatic" : "manual") } };
    }

    case "textarea": {
      return { question: { ...base, type, evaluator: evaluatorExplicit ?? "manual" } };
    }

    case "number": {
      const errors: LaboratoryParseError[] = [];
      if (attrs.expected !== undefined && parseNumberAttr(attrs.expected) === undefined) {
        errors.push({ questionId: id, message: `Question "${id}" tiene "expected" no numérico: "${attrs.expected}".` });
      }
      if (attrs.tolerance !== undefined && parseNumberAttr(attrs.tolerance) === undefined) {
        errors.push({ questionId: id, message: `Question "${id}" tiene "tolerance" no numérico: "${attrs.tolerance}".` });
      }
      if (errors.length > 0) return { errors };

      const expected = parseNumberAttr(attrs.expected);
      const tolerance = parseNumberAttr(attrs.tolerance);
      return {
        question: { ...base, type, expected, tolerance, evaluator: evaluatorExplicit ?? (expected !== undefined ? "automatic" : "manual") },
      };
    }

    case "boolean": {
      const correctRaw = attrs.correct?.trim();
      const correct = correctRaw === undefined ? undefined : correctRaw.toLowerCase() === "true";
      return { question: { ...base, type, correct, evaluator: evaluatorExplicit ?? (correctRaw !== undefined ? "automatic" : "manual") } };
    }

    case "single-choice":
    case "select": {
      const options = splitPipeList(attrs.options);
      if (!options || options.length < 2) {
        return { errors: [{ questionId: id, message: `Question "${id}" uses type="${type}" but does not define options.` }] };
      }
      const correct = attrs.correct?.trim();
      if (correct !== undefined && !options.includes(correct)) {
        return { errors: [{ questionId: id, message: `Question "${id}": correct="${correct}" no existe entre las options definidas (${options.join(", ")}).` }] };
      }
      return { question: { ...base, type, options, correct, evaluator: evaluatorExplicit ?? (correct !== undefined ? "automatic" : "manual") } };
    }

    case "multiple-choice": {
      const options = splitPipeList(attrs.options);
      if (!options || options.length < 2) {
        return { errors: [{ questionId: id, message: `Question "${id}" uses type="multiple-choice" but does not define options.` }] };
      }
      const correct = splitPipeList(attrs.correct);
      if (correct) {
        const invalid = correct.filter((c) => !options.includes(c));
        if (invalid.length > 0) {
          return {
            errors: [
              { questionId: id, message: `Question "${id}": correct=[${invalid.join(", ")}] no existen entre las options definidas (${options.join(", ")}).` },
            ],
          };
        }
      }
      return { question: { ...base, type, options, correct, evaluator: evaluatorExplicit ?? (correct !== undefined ? "automatic" : "manual") } };
    }

    case "code": {
      const language = attrs.language?.trim() || "text";
      return { question: { ...base, type, language, evaluator: evaluatorExplicit ?? "manual" } };
    }

    case "github-pr": {
      const source = attrs.source?.trim();
      if (!source) {
        return { errors: [{ questionId: id, message: `Question "${id}" uses type="github-pr" but does not define "source".` }] };
      }
      if (evaluatorExplicit === "automatic") {
        return {
          errors: [
            { questionId: id, message: `Question "${id}" uses type="github-pr", which does not support evaluator="automatic".` },
          ],
        };
      }
      const evaluator: "manual" | "ai" = evaluatorExplicit === "ai" ? "ai" : "manual";
      return { question: { ...base, type, source, evaluator } };
    }
  }
}
