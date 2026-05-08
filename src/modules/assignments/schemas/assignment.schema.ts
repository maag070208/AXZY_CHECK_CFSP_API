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
      .uuid("El id de quien asigna debe ser un UUID"),
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
