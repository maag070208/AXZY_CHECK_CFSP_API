import { z } from "zod";
import { CreateClientSchema, UpdateClientSchema } from "./schemas/clients.schema";

export type IClientCreateRequest = z.infer<typeof CreateClientSchema>["body"];
export type IClientUpdateRequest = z.infer<typeof UpdateClientSchema>["body"];
