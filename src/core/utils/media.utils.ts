import { Prisma } from "@prisma/client";

/**
 * Utilidades para el campo `media` de incidencias, mantenimientos y kardex.
 *
 * Contrato real de la API: los schemas Zod aceptan `media: string[]` (URLs).
 * Históricamente algunos registros antiguos guardaron objetos `{ key, url }`,
 * así que el filtrado debe entender **ambas formas** para no dejar de borrar
 * (un bug anterior devolvía 200 sin eliminar nada cuando el media era string).
 */

/** Extrae el nombre de archivo (último segmento) de una ruta o URL. */
const basename = (value: string): string => value.split("/").pop() || value;

/** ¿Alguno de los candidatos corresponde a la clave solicitada? */
const matchesKey = (candidates: string[], key: string): boolean => {
  const targetBase = basename(key);
  return candidates.some((c) => c === key || basename(c) === targetBase);
};

/** Candidatos comparables de una entrada de `media` (string u objeto). */
const candidatesOf = (entry: unknown): string[] | null => {
  if (typeof entry === "string") return [entry];
  if (entry && typeof entry === "object") {
    const obj = entry as { key?: unknown; url?: unknown };
    const candidates: string[] = [];
    if (typeof obj.key === "string") candidates.push(obj.key);
    if (typeof obj.url === "string") candidates.push(obj.url);
    return candidates.length > 0 ? candidates : null;
  }
  return null;
};

/**
 * Devuelve una copia de `media` sin la entrada cuyo `key`/URL corresponda a
 * `key`. Las entradas no reconocibles se conservan (nunca se borra a ciegas).
 */
export const removeMediaByKey = (
  media: unknown,
  key: string,
): Prisma.InputJsonValue[] => {
  if (!Array.isArray(media)) return [];

  const result: Prisma.InputJsonValue[] = [];

  for (const entry of media) {
    const candidates = candidatesOf(entry);

    // Sin datos reconocibles: se conserva tal cual.
    if (candidates === null) {
      result.push(entry as Prisma.InputJsonValue);
      continue;
    }

    if (!matchesKey(candidates, key)) {
      result.push(entry as Prisma.InputJsonValue);
    }
  }

  return result;
};

/** ¿El `media` contiene la clave indicada? (para responder 404 real). */
export const mediaHasKey = (media: unknown, key: string): boolean => {
  if (!Array.isArray(media)) return false;

  return media.some((entry) => {
    const candidates = candidatesOf(entry);
    return candidates !== null && matchesKey(candidates, key);
  });
};
