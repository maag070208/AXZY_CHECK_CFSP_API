import { z } from "zod";
import { CreateLocationSchema, UpdateLocationSchema } from "./schemas/locations.schema";

export type ILocationCreateRequest = z.infer<typeof CreateLocationSchema>["body"];
export type ILocationUpdateRequest = z.infer<typeof UpdateLocationSchema>["body"];
