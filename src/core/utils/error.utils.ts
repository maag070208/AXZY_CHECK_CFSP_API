/** Extrae el mensaje de un error desconocido sin recurrir a `any`. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
