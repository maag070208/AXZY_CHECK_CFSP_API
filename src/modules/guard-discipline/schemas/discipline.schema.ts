import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    value: z.string().min(1, "El valor es obligatorio"),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid("ID de categoría inválido") }),
  body: z.object({
    name: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
  }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de categoría inválido") }),
});

export const createTypeSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("ID de categoría inválido"),
    name: z.string().min(1, "El nombre es obligatorio"),
    value: z.string().min(1, "El valor es obligatorio"),
  }),
});

export const updateTypeSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de tipo inválido") }),
  body: z.object({
    categoryId: z.string().uuid("ID de categoría inválido").optional(),
    name: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
  }),
});

export const typeIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de tipo inválido") }),
});

export const createDisciplineSchema = z.object({
  body: z.object({
    guardId: z.string().uuid("ID del guardia inválido"),
    title: z.string().min(1, "El título es obligatorio"),
    categoryId: z.string().uuid("ID de categoría inválido").optional().nullable(),
    typeId: z.string().uuid("ID de tipo inválido").optional().nullable(),
    description: z.string().optional().nullable(),
    clientId: z.string().uuid("ID de cliente inválido").optional().nullable(),
    media: z.array(z.object({
      url: z.string(),
      type: z.enum(["photo", "video"]),
    })).optional().default([]),
  }),
});

export const updateDisciplineSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de registro inválido") }),
  body: z.object({
    title: z.string().min(1).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    typeId: z.string().uuid().optional().nullable(),
    description: z.string().optional().nullable(),
    status: z.enum(["PENDING", "RESOLVED", "DISMISSED"]).optional(),
  }),
});

export const disciplineIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de registro inválido") }),
});

export const resolveDisciplineSchema = z.object({
  params: z.object({ id: z.string().uuid("ID de registro inválido") }),
  body: z.object({
    description: z.string().optional().nullable(),
    status: z.enum(["RESOLVED", "DISMISSED"]),
  }),
});
