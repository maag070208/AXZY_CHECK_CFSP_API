import { checkUserShift } from './shift.utils';
import * as dateTimeUtils from './date-time.utils';

jest.mock('./date-time.utils');

describe('Shift Utils', () => {
  const mockUser = {
    role: 'GUARD',
    shiftStart: '08:00',
    shiftEnd: '17:00',
  };

  it('should allow access if user is not in operational roles', () => {
    const result = checkUserShift({ role: 'ADMIN' });
    expect(result.canAccess).toBe(true);
  });

  it('should deny access if shift is not configured for guard', () => {
    const result = checkUserShift({ role: 'GUARD', shiftStart: null, shiftEnd: null });
    expect(result.canAccess).toBe(false);
    expect(result.message).toContain('No tiene un horario asignado');
  });

  it('should allow access if in shift', () => {
    (dateTimeUtils.isInShift as jest.Mock).mockReturnValue(true);
    const result = checkUserShift(mockUser);
    expect(result.canAccess).toBe(true);
  });

  it('should deny access if out of shift', () => {
    (dateTimeUtils.isInShift as jest.Mock).mockReturnValue(false);
    const result = checkUserShift(mockUser);
    expect(result.canAccess).toBe(false);
    expect(result.message).toBe('Fuera de horario de turno');
  });
});
