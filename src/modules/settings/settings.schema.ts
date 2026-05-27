import { z } from "zod";

export const CreateIncidentCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    value: z.string().min(1, "El valor es obligatorio"),
    type: z.enum(["INCIDENT", "MAINTENANCE"]).optional().default("INCIDENT"),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
  }),
});

export const UpdateIncidentCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de categoría inválido"),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    type: z.enum(["INCIDENT", "MAINTENANCE"]).optional(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
  }),
});

export const CategoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de categoría inválido"),
  }),
});

export const CreateIncidentTypeSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("ID de categoría inválido"),
    name: z.string().min(1, "El nombre es obligatorio"),
    value: z.string().min(1, "El valor es obligatorio"),
  }),
});

export const UpdateIncidentTypeSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de tipo inválido"),
  }),
  body: z.object({
    categoryId: z.string().uuid("ID de categoría inválido").optional(),
    name: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
  }),
});

export const TypeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de tipo inválido"),
  }),
});

export const UpdateSysConfigSchema = z.object({
  body: z.object({
    key: z.string().min(1, "La llave de configuración es obligatoria"),
    value: z.string().min(1, "El valor de configuración es obligatorio"),
  }),
});

export const SysConfigKeyParamSchema = z.object({
  params: z.object({
    key: z.string().min(1, "La llave de configuración es obligatoria"),
  }),
});
