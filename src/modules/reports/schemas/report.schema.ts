import { z } from "zod";

/** Fecha en formato YYYY-MM-DD. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const generateAdministrativeReportSchema = z.object({
  body: z.object({
    recurringConfigurationIds: z
      .array(z.string().uuid("Formato de UUID inválido")),
    startDate: z.string().min(1, "La fecha de inicio es requerida"),
    endDate: z.string().min(1, "La fecha de fin es requerida"),
  }),
});

/** Filtros del resumen analítico de incidencias (`GET /reports/incidents/summary`). */
export const incidentSummaryQuerySchema = z.object({
  query: z.object({
    startDate: z
      .string()
      .regex(ISO_DATE, { message: "startDate debe tener formato YYYY-MM-DD" })
      .optional(),
    endDate: z
      .string()
      .regex(ISO_DATE, { message: "endDate debe tener formato YYYY-MM-DD" })
      .optional(),
    clientId: z
      .string()
      .uuid({ message: "clientId debe ser un UUID válido" })
      .optional(),
  }),
});

