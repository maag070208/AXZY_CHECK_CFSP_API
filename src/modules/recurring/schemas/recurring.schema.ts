import { z } from "zod";

export const recurringTaskSchema = z.object({
  description: z.string().min(1, "La descripción de la tarea es requerida"),
  reqPhoto: z.boolean().default(false),
});

export const recurringLocationSchema = z.object({
  locationId: z.string().uuid("ID de ubicación inválido"),
  tasks: z.array(recurringTaskSchema).optional().default([]),
});

export const createRecurringSchema = z.object({
  body: z.object({
    title: z.string().min(1, "El título es requerido"),
    clientId: z.string().uuid("ID de cliente inválido"),
    locations: z.array(recurringLocationSchema).min(1, "Debe agregar al menos una ubicación"),
    guardIds: z.array(z.string().uuid()).optional().default([]),
    active: z.boolean().optional().default(true),
  })
});

export const updateRecurringSchema = z.object({
  body: z.object({
    title: z.string().min(1, "El título es requerido").optional(),
    clientId: z.string().uuid("ID de cliente inválido").optional(),
    locations: z.array(recurringLocationSchema).min(1, "Debe agregar al menos una ubicación").optional(),
    guardIds: z.array(z.string().uuid()).optional(),
    active: z.boolean().optional(),
  })
});

export const RecurringIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de tarea recurrente inválido"),
  }),
});

export const RecurringGuardIdParamSchema = z.object({
  params: z.object({
    guardId: z.string().uuid("ID de guardia inválido"),
  }),
});

