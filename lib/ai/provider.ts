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

export interface EvidenceItem {
  file: string;
  line?: number;
  reason: string;
}

export interface TextEvaluationResult {
  suggestedScore: number;
  feedback: string;
  /** Populated when the model can point at specific evidence (e.g. a code diff) — empty/absent for plain prose answers. */
  evidence?: EvidenceItem[];
  /** Self-reported by the model; neither adapter computes a calibrated value, so treat this as a soft signal only. */
  confidence?: number;
  raw: unknown;
  model: string;
}

export interface AiProvider {
  evaluateCodeAnswer(input: CodeEvaluationInput): Promise<CodeEvaluationResult>;
  /** Grades a free-text answer (e.g. a laboratory's `textarea` question) against an optional rubric. */
  evaluateTextAnswer(input: TextEvaluationInput): Promise<TextEvaluationResult>;
}
