import { z } from "zod";

export const CreateScheduledSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    message: z.string().min(1),
    type: z.enum(["info", "success", "warning", "error"]).default("info"),
    persistent: z.boolean().default(false),
    userId: z.string().optional(),
    channel: z.string().default("global"),
    scheduledAt: z.string().datetime().optional(),
    frequency: z.enum(["ONCE", "DAILY", "EVERY_2_DAYS", "WEEKLY", "EVERY_2_WEEKS", "MONTHLY"]).default("ONCE"),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    daysOfWeek: z.string().optional(),
    active: z.boolean().default(true),
  }),
});

export const UpdateScheduledSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    message: z.string().optional(),
    type: z.enum(["info", "success", "warning", "error"]).optional(),
    persistent: z.boolean().optional(),
    userId: z.string().optional(),
    channel: z.string().optional(),
    scheduledAt: z.string().datetime().optional().nullable(),
    frequency: z.enum(["ONCE", "DAILY", "EVERY_2_DAYS", "WEEKLY", "EVERY_2_WEEKS", "MONTHLY"]).optional(),
    timeOfDay: z.string().optional(),
    daysOfWeek: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const ScheduledIdParam = z.object({
  params: z.object({ id: z.string().uuid() }),
});
