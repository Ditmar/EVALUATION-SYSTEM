import { z } from "zod";

export const ActivityEventSchema = z.object({
  type: z.enum(["tab_hidden", "window_blur", "fullscreen_exit", "heartbeat", "reconnect", "other", "screen_share_started", "screen_share_stopped"]),
  detail: z.string().max(500).optional(),
});

export type ActivityEventInput = z.infer<typeof ActivityEventSchema>;

export const AnswerSubmitSchema = z.union([
  z.object({ selectedOption: z.string().min(1) }),
  z.object({ selectedOptions: z.array(z.string().min(1)) }),
  z.object({ codeAnswer: z.string() }),
  // CODE_IDE: editable files + stdin (validated against the question in the route).
  z.object({
    codeFiles: z.object({
      files: z.array(z.object({ name: z.string().min(1).max(64), content: z.string().max(256 * 1024) })).max(20),
      stdin: z.string().max(64 * 1024).optional(),
    }),
  }),
]);

export type AnswerSubmitInput = z.infer<typeof AnswerSubmitSchema>;
