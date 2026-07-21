import { z } from "zod";

export const createReportConfigurationSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre es requerido"),
    description: z.string().optional(),
    reportType: z.string().min(1, "El tipo de reporte es requerido"),
    clientId: z.string().nullable().optional(),
    configuration: z.any(),
    cronExpression: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateReportConfigurationSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    reportType: z.string().optional(),
    clientId: z.string().nullable().optional(),
    configuration: z.any().optional(),
    cronExpression: z.string().optional(),
    active: z.boolean().optional(),
    softDelete: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid("ID inválido"),
  }),
});

export const DeleteReportConfigurationSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID inválido"),
  }),
});

