import { z } from "zod";
import { CreateZoneSchema, UpdateZoneSchema } from "./schemas/zones.schema";

export type IZoneCreateRequest = z.infer<typeof CreateZoneSchema>["body"];
export type IZoneUpdateRequest = z.infer<typeof UpdateZoneSchema>["body"];
