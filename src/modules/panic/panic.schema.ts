import { z } from "zod";

/**
 * Schema para crear una alerta de pánico desde la app móvil.
 * El guardia NO necesita estar en una ronda activa ni proporcionar
 * locationId: la alerta es independiente del contexto de trabajo.
 */
export const CreatePanicAlertSchema = z.object({
  body: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    accuracy: z.number().optional(),
    source: z.enum(["volume_button", "manual"]).default("volume_button"),
    notes: z.string().max(500).optional(),
  }),
});

export const PanicAlertIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de alerta inválido"),
  }),
});
