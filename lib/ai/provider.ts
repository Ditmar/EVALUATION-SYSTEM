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

export interface AiProvider {
  evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult>;
}
