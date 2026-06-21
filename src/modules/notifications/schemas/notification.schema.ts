import { z } from "zod";

export const SendNotificationSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    message: z.string().min(1, "El mensaje es requerido"),
    type: z.enum(["info", "success", "warning", "error"]).default("info"),
    channel: z.string().default("global"),
    userId: z.string().optional(),
    persistent: z.boolean().default(false),
  }),
});
