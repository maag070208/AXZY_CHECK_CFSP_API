import { z } from "zod";

export const SendNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1, "El título es requerido"),
    message: z.string().min(1, "El mensaje es requerido"),
    type: z.enum(["info", "success", "warning", "error"]).default("info"),
    channel: z.string().default("global"),
  }),
});
