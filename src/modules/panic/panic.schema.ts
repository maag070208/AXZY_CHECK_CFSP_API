import { z } from "zod";

export const CreatePanicAlertSchema = z.object({
  body: z.object({
    source: z.string().max(50).default("volume_button"),
    triggerLatitude: z.number().optional(),
    triggerLongitude: z.number().optional(),
    triggerAccuracy: z.number().optional(),
    message: z.string().max(500).optional(),
  }),
});

export const PanicAlertIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de alerta inválido"),
  }),
});

export const ResolvePanicAlertSchema = z.object({
  body: z.object({
    resolutionComment: z.string().max(1000).optional(),
    status: z.enum(["IN_PROGRESS", "RESOLVED", "DISMISSED"]).optional(),
  }),
});

export const PanicAlertsDataTableSchema = z.object({
  body: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(200).default(20),
    filters: z
      .object({
        status: z.string().optional(),
        guardId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        search: z.string().optional(),
      })
      .optional()
      .default({}),
    sort: z
      .object({
        key: z.string(),
        direction: z.enum(["asc", "desc"]),
      })
      .optional(),
  }),
});
