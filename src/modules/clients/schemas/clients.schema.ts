import { z } from "zod";

export const CreateClientSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre no puede estar vacío"),
    address: z.string().optional(),
    rfc: z.string().optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    active: z.boolean().optional().default(true),
    appUsername: z.string().optional(),
    appPassword: z.string().optional(),
  }),
});

export const UpdateClientSchema = z.object({
  body: z.object({
    name: z.string().min(1, "El nombre no puede estar vacío").optional(),
    address: z.string().optional(),
    rfc: z.string().optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    active: z.boolean().optional(),
    appUsername: z.string().optional(),
    appPassword: z.string().optional(),
    softDelete: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid("ID de cliente inválido"),
  }),
});

export const ClientIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de cliente inválido"),
  }),
});
