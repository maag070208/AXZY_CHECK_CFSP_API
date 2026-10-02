import { ROLE_CLIENT } from "../config/constants";
import { IAuthUser } from "../dto/auth-user.dto";
import { AppError } from "../errors/AppError";

/**
 * @description Resuelve el cliente al que debe limitarse una consulta.
 * Un usuario cliente (RESDN) siempre queda restringido a su propio cliente,
 * ignorando lo que pida; el resto puede filtrar opcionalmente.
 * @returns el `clientId` a aplicar, o `undefined` para no filtrar.
 */
export const resolveClientScope = (
  user: IAuthUser,
  requestedClientId?: string | null,
): string | undefined => {
  if (user.role === ROLE_CLIENT) {
    if (!user.clientId) throw new AppError("Tu usuario no tiene un cliente asignado", 403);
    return user.clientId;
  }
  return requestedClientId || undefined;
};
