import { z } from "zod";

export const StartRoundSchema = z.object({
  body: z.object({
    guardId: z.string().uuid("El ID de guardia debe ser un UUID válido").optional(),
    clientId: z.string().uuid("El ID de cliente debe ser un UUID válido").optional(),
    recurringConfigurationId: z.string().uuid("El ID de configuración debe ser un UUID válido").optional(),
  }),
});

export const RoundIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
