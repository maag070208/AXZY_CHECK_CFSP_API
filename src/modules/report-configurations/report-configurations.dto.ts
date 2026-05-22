import { z } from "zod";
import { createReportConfigurationSchema, updateReportConfigurationSchema } from "./schemas/report-configuration.schema";

export type CreateReportConfigurationDTO = z.infer<typeof createReportConfigurationSchema>["body"];
export type UpdateReportConfigurationDTO = z.infer<typeof updateReportConfigurationSchema>["body"];
