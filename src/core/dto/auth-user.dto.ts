/**
 * Payload del JWT disponible en `res.locals.user` tras `authenticate`.
 * Se construye en el login (`user.controller.ts`).
 */
export interface IAuthUser {
  id: string;
  name: string;
  lastName?: string | null;
  username: string;
  role: string;
  clientId: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
}
