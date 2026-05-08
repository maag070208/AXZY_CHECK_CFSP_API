import { z } from "zod";

export const CreateLocationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre no puede estar vacío"),
    clientId: z.string().uuid("ID de cliente inválido"),
    zoneId: z.string().uuid("ID de zona inválido").optional(),
    reference: z.string().optional(),
    aisle: z.string().optional(),
    spot: z.string().optional(),
    number: z.string().optional(),
  }),
});

export const UpdateLocationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre no puede estar vacío").optional(),
    clientId: z.string().uuid("ID de cliente inválido").optional(),
    zoneId: z.string().uuid("ID de zona inválido").optional().nullable(),
    reference: z.string().optional().nullable(),
    aisle: z.string().optional().nullable(),
    spot: z.string().optional().nullable(),
    number: z.string().optional().nullable(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid("ID de ubicación inválido"),
  }),
});

export const LocationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de ubicación inválido"),
  }),
});
