import { z } from "zod";

export const CreateScheduleSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre no puede estar vacío"),
    startTime: z.string().min(1, "La hora de inicio es requerida"),
    endTime: z.string().min(1, "La hora de fin es requerida"),
  }),
});

export const UpdateScheduleSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre no puede estar vacío").optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid("ID de horario inválido"),
  }),
});

export const ScheduleIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de horario inválido"),
  }),
});
