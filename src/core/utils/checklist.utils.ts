import { z } from "zod";
import { IChecklistItemDefinition } from "../config/constants";
import { AppError } from "../errors/AppError";

/** Respuesta de un elemento de checklist enviada por el cliente. */
export const checklistAnswersSchema = z
  .array(
    z.object({
      key: z.string().min(1, "Clave de elemento inválida"),
      ok: z.boolean({ message: "Indica si el elemento cumple" }),
    }),
  )
  .default([]);

export type ChecklistAnswer = z.infer<typeof checklistAnswersSchema>[number];

export interface IChecklistResult {
  /** Lista completa en el orden del catálogo (faltantes = no cumple). */
  items: ChecklistAnswer[];
  okCount: number;
  total: number;
  /** Porcentaje 0-100 redondeado. */
  score: number;
}

/**
 * @description Normaliza respuestas contra un catálogo: rechaza claves que
 * no existen, completa las omitidas como `ok: false` y calcula el puntaje.
 */
export const normalizeChecklist = (
  catalog: IChecklistItemDefinition[],
  answers: ChecklistAnswer[] = [],
): IChecklistResult => {
  const validKeys = new Set(catalog.map((c) => c.key));
  const unknown = answers.filter((a) => !validKeys.has(a.key)).map((a) => a.key);
  if (unknown.length > 0) {
    throw new AppError(`Elementos de checklist no reconocidos: ${unknown.join(", ")}`, 400);
  }

  const byKey = new Map(answers.map((a) => [a.key, a.ok]));
  const items = catalog.map((c) => ({ key: c.key, ok: byKey.get(c.key) ?? false }));
  const okCount = items.filter((i) => i.ok).length;
  const total = items.length;
  return { items, okCount, total, score: total > 0 ? Math.round((okCount / total) * 100) : 0 };
};
