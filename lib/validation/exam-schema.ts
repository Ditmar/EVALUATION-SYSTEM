import { z } from "zod";

export const OptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const BaseQuestionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  points: z.number().positive(),
});

export const SingleChoiceQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("single_choice"),
  options: z.array(OptionSchema).min(2),
  correctAnswer: z.string().min(1),
});

export const MultipleChoiceQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("multiple_choice"),
  options: z.array(OptionSchema).min(2),
  correctAnswers: z.array(z.string().min(1)).min(1),
});

export const CODE_LANGUAGES = ["javascript", "typescript", "java"] as const;

export const CodeQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal("code"),
  language: z.enum(CODE_LANGUAGES),
  expectedSolution: z.string().optional(),
  rubric: z.string().optional(),
  enableAiEvaluation: z.boolean().default(false),
});

export const QuestionSchema = z
  .discriminatedUnion("type", [
    SingleChoiceQuestionSchema,
    MultipleChoiceQuestionSchema,
    CodeQuestionSchema,
  ])
  .superRefine((q, ctx) => {
    if (q.type === "single_choice") {
      if (!q.options.some((o) => o.id === q.correctAnswer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctAnswer "${q.correctAnswer}" debe existir entre las options de la pregunta "${q.id}"`,
          path: ["correctAnswer"],
        });
      }
    }
    if (q.type === "multiple_choice") {
      const invalid = q.correctAnswers.filter((id) => !q.options.some((o) => o.id === id));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctAnswers [${invalid.join(", ")}] deben existir entre las options de la pregunta "${q.id}"`,
          path: ["correctAnswers"],
        });
      }
    }
  });

export type QuestionInput = z.infer<typeof QuestionSchema>;

export const ExamMetadataSchema = z.object({
  title: z.string().min(1),
  career: z.string().min(1),
  academicTerm: z.string().min(1),
  subject: z.string().min(1),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "examDate debe tener formato YYYY-MM-DD"),
  durationMinutes: z.number().int().positive(),
  instructions: z.string().min(1),
  evaluationType: z.string().min(1),
});

export const ExamSettingsSchema = z.object({
  maxPenalties: z.number().int().positive().default(3),
  onMaxPenalties: z.enum(["auto_submit", "warn_only", "lock_exam"]).default("auto_submit"),
  trackFocusEvents: z.boolean().default(true),
  monitorExternalIps: z.boolean().default(true),
  differentIpPolicy: z.enum(["off", "warn_only", "block"]).default("off"),
  allowAiCodeEvaluation: z.boolean().default(true),
});

export const ExamImportSchema = z
  .object({
    metadata: ExamMetadataSchema,
    settings: ExamSettingsSchema.default({}),
    questions: z.array(QuestionSchema).min(1, "El examen debe tener al menos una pregunta"),
  })
  .superRefine((exam, ctx) => {
    const ids = exam.questions.map((q) => q.id);
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    if (duplicates.size > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Los siguientes ids de pregunta están duplicados: ${[...duplicates].join(", ")}`,
        path: ["questions"],
      });
    }
  });

export type ExamImportInput = z.infer<typeof ExamImportSchema>;
