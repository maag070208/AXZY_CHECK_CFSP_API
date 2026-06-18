import { z } from "zod";

export const createAssignmentSchema = z.object({
  body: z.object({
    guardId: z
      .string("Ingrese el id del guardia")
      .uuid("El id del guardia debe ser un UUID"),
    locationId: z
      .string("Ingrese el id de la ubicación")
      .uuid("El id de la ubicación debe ser un UUID"),
    assignedBy: z
      .string("Ingrese el id de quien asigna")
      .uuid("El id de quien asigna debe ser un UUID")
      .optional(),
    notes: z.string("Ingrese notas").optional(),
    tasks: z
      .array(
        z.object({
          description: z
            .string()
            .min(1, "Descripción de la tarea es requerida"),
          reqPhoto: z.boolean().default(false),
        }),
      )
      .optional(),
  }),
});

export type CreateAssignmentSchema = z.infer<
  typeof createAssignmentSchema
>["body"];

export const UpdateAssignmentStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de asignación inválido"),
  }),
  body: z.object({
    status: z.enum(['PENDING', 'CHECKING', 'UNDER_REVIEW', 'REVIEWED', 'ANOMALY'], {
      message: "Estado de asignación inválido",
    }),
  }),
});

export const ToggleTaskSchema = z.object({
  params: z.object({
    taskId: z.string().uuid("ID de tarea inválido"),
  }),
});

export const GetAllAssignmentsQuerySchema = z.object({
  query: z.object({
    id: z.string().uuid("ID inválido").optional(),
    guardId: z.string().uuid("ID de guardia inválido").optional(),
    status: z.enum(['PENDING', 'CHECKING', 'UNDER_REVIEW', 'REVIEWED', 'ANOMALY']).optional(),
  }),
});

export const GetMyAssignmentsQuerySchema = z.object({
  query: z.object({
    guardId: z.string().uuid("ID de guardia inválido").optional(),
  }),
});

