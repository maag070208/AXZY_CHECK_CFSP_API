import { z } from "zod";

export const CreateMaintenanceSchema = z.object({
  body: z.object({
    title: z.string().min(1, "El título es obligatorio"),
    description: z.string().optional(),
    categoryId: z.string().uuid("La categoría debe ser un UUID válido").optional(),
    typeId: z.string().uuid("El tipo debe ser un UUID válido").optional(),
    category: z.string().optional(),
    media: z.array(z.string()).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    clientId: z.string().uuid("El cliente debe ser un UUID válido").optional(),
  }),
});

export const MaintenanceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de mantenimiento inválido"),
  }),
});

export const GetMaintenancesQuerySchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    guardId: z.string().uuid("El ID de guardia debe ser un UUID válido").optional(),
    category: z.string().optional(),
    title: z.string().optional(),
  }),
});

export const DeleteMaintenanceMediaSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de mantenimiento inválido"),
  }),
  query: z.object({
    key: z.string().min(1, "El key del archivo es requerido"),
  }),
});
