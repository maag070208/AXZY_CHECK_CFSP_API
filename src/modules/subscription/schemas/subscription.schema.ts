import { z } from "zod";

/** Configuración de suscripción: todos los campos son opcionales (actualización parcial). */
export const UpdateSubscriptionConfigSchema = z.object({
  body: z.object({
    paid: z.boolean({ message: "El campo paid debe ser booleano" }).optional(),
    trialDaysRemaining: z
      .number({ message: "Los días de prueba deben ser un número" })
      .int("Los días de prueba deben ser un entero")
      .min(0, "Los días de prueba no pueden ser negativos")
      .optional(),
    showTrialWatermark: z
      .boolean({ message: "El campo showTrialWatermark debe ser booleano" })
      .optional(),
    showTrialBadge: z
      .boolean({ message: "El campo showTrialBadge debe ser booleano" })
      .optional(),
  }),
});

export type IUpdateSubscriptionConfig = z.infer<
  typeof UpdateSubscriptionConfigSchema
>["body"];
