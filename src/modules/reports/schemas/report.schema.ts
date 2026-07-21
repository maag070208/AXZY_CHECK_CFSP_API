import { z } from "zod";

export const generateAdministrativeReportSchema = z.object({
  body: z.object({
    recurringConfigurationIds: z
      .array(z.string().uuid("Formato de UUID inválido")),
    startDate: z.string().min(1, "La fecha de inicio es requerida"),
    endDate: z.string().min(1, "La fecha de fin es requerida"),
  }),
});
