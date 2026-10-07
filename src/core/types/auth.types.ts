/**
 * Usuario autenticado, tal como viaja en `res.locals.user`.
 *
 * Viene del JWT (`decoded`) y de los mocks de tests. Los campos opcionales
 * reflejan que en los tests sólo se inyecta `id` + `role`.
 */
export interface AuthenticatedUser {
  id: string;
  /** El JWT y los mocks de tests siempre lo traen. */
  role: string;
  name?: string;
  lastName?: string;
  username?: string;
  clientId?: string | null;
  shiftStart?: string;
  shiftEnd?: string;
}
