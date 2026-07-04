import { z } from "zod";

export const ActivityEventSchema = z.object({
  type: z.enum(["tab_hidden", "window_blur", "fullscreen_exit", "heartbeat", "reconnect", "other"]),
  detail: z.string().max(500).optional(),
});

export type ActivityEventInput = z.infer<typeof ActivityEventSchema>;

export const AnswerSubmitSchema = z.union([
  z.object({ selectedOption: z.string().min(1) }),
  z.object({ selectedOptions: z.array(z.string().min(1)) }),
  z.object({ codeAnswer: z.string() }),
]);

export type AnswerSubmitInput = z.infer<typeof AnswerSubmitSchema>;
