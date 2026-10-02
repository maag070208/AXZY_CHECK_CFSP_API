import { z } from "zod";
import { checklistAnswersSchema } from "@src/core/utils/checklist.utils";

export const createUniformCheckSchema = z.object({
  body: z.object({
    guardId: z.string().uuid("ID de guardia inválido"),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD").optional(),
    items: checklistAnswersSchema,
    notes: z.string().max(1000, "Las notas no deben exceder 1000 caracteres").optional().nullable(),
  }),
});

export const uniformCheckIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de revisión inválido") }),
});
