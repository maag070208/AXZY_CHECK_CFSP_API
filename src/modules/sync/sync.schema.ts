import { z } from "zod";

export const pullSchema = z.object({
  query: z.object({
    last_pulled_at: z
      .string()
      .regex(/^\d+$/, "last_pulled_at debe ser un timestamp numérico de milisegundos")
      .optional(),
    reset_models: z
      .string()
      .optional(),
  }),
});

export const pushSchema = z.object({
  body: z.object({
    changes: z.record(
      z.string(),
      z.object({
        created: z.array(z.record(z.string(), z.any())),
        updated: z.array(z.record(z.string(), z.any())),
        deleted: z.array(z.string()),
      })
    ),
  }),
});
