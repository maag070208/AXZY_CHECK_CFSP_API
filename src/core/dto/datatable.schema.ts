import { z } from "zod";

export const DataTableFetchParamsSchema = z.object({
  body: z.object({
    page: z.number({ message: "page es requerido" }).int().min(1, "page debe ser mayor o igual a 1"),
    limit: z.number({ message: "limit es requerido" }).int().min(1, "limit debe ser mayor o igual a 1"),
    filters: z.record(z.string(), z.any()).optional().default({}),
    sort: z.object({
      key: z.string(),
      direction: z.enum(["asc", "desc"], { message: "Dirección de ordenamiento inválida" })
    }).optional()
  })
});
