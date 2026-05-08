import { OPERATIONAL_ROLES } from '../config/constants';
import { isInShift } from './date-time.utils';

export const checkUserShift = (user: { role: string; shiftStart?: string | null; shiftEnd?: string | null }) => {
  if (!OPERATIONAL_ROLES.includes(user.role)) return { canAccess: true };
  
  if (!user.shiftStart || !user.shiftEnd) {
    return { canAccess: false, message: 'No tiene un horario asignado o configurado correctamente' };
  }

  const inShift = isInShift(user.shiftStart, user.shiftEnd);
  
  if (!inShift) {
    return { canAccess: false, message: 'Fuera de horario de turno' };
  }

  return { canAccess: true };
};
