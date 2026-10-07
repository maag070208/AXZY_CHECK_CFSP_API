import { ROLE_CLIENT } from "../config/constants";
import { AppError } from "../errors/AppError";

/** Mínimo necesario del usuario para resolver el alcance por cliente. */
export interface IClientScopeUser {
  role: string;
  clientId?: string | null;
}

/**
 * @description Resuelve el cliente al que debe limitarse una consulta.
 * Un usuario cliente (RESDN) siempre queda restringido a su propio cliente,
 * ignorando lo que pida; el resto puede filtrar opcionalmente.
 * @returns el `clientId` a aplicar, o `undefined` para no filtrar.
 * @throws AppError 403 si un usuario de cliente no tiene cliente asignado
 *         (antes estos servicios no filtraban y exponían datos de otras empresas).
 */
export const resolveClientScope = (
  user: IClientScopeUser,
  requestedClientId?: string | null,
): string | undefined => {
  if (user.role === ROLE_CLIENT) {
    if (!user.clientId) throw new AppError("Tu usuario no tiene un cliente asignado", 403);
    return user.clientId;
  }
  return requestedClientId || undefined;
};
