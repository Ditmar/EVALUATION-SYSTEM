export interface CodeEvaluationInput {
  statement: string;
  language: string;
  expectedSolution?: string | null;
  rubric?: string | null;
  studentCode: string;
  maxPoints: number;
}

export interface CodeEvaluationResult {
  suggestedScore: number;
  feedback: string;
  raw: unknown;
  model: string;
}

export interface TextEvaluationInput {
  question: string;
  rubric?: string | null;
  studentAnswer: string;
  maxPoints: number;
}

export interface TextEvaluationResult {
  suggestedScore: number;
  feedback: string;
  raw: unknown;
  model: string;
}

export interface AiProvider {
  evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult>;
  /** Grades a free-text answer (e.g. a laboratory's `textarea` question) against an optional rubric. */
  evaluateTextAnswer(input: TextEvaluationInput): Promise<TextEvaluationResult>;
}
