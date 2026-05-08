import { z } from "zod";

export const CreateIncidentSchema = z.object({
  body: z.object({
    title: z.string().min(1, "El título es obligatorio"),
    description: z.string().optional(),
    categoryId: z.string().uuid("La categoría debe ser un UUID válido").optional(),
    typeId: z.string().uuid("El tipo debe ser un UUID válido").optional(),
    locationId: z.string().uuid("La ubicación debe ser un UUID válido").optional(),
    media: z.array(z.string()).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    clientId: z.string().uuid("El cliente debe ser un UUID válido").optional(),
  }),
});

export const IncidentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
