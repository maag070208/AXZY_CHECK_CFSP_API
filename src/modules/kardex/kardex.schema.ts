import { z } from "zod";

export const CreateKardexSchema = z.object({
  body: z.object({
    userId: z.string().uuid("El ID de usuario debe ser un UUID válido"),
    locationId: z.string().uuid("El ID de ubicación debe ser un UUID válido"),
    notes: z.string().optional(),
    media: z.array(z.string()).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    assignmentId: z.string().uuid("El ID de asignación debe ser un UUID válido").optional().nullable(),
    scanType: z.enum(["FREE", "RECURRING", "ASSIGNMENT"]).optional(),
  }),
});

export const UpdateKardexSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    notes: z.string().optional(),
    media: z.array(z.string()).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

export const KardexIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
