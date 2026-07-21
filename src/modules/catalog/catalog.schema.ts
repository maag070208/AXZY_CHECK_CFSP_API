import { z } from "zod";

export const CatalogKeySchema = z.object({
  params: z.object({
    key: z.string().min(1, "La llave de catálogo no puede estar vacía"),
  }),
});
