import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { prismaClient } from "@src/core/config/database";
import { DEFAULT_TIMEZONE, ROLE_ADMIN, ROLE_CLIENT, ROLE_GUARD } from "@src/core/config/constants";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Datos de prueba para entregas de turno, uniformes y programación:
 * un cliente, un horario que INICIÓ hace 2 horas (así sus compromisos ya
 * están vencidos) y un guardia asignado a ese cliente y horario.
 */
export interface ISupervisionFixture {
  adminHeader: string;
  clientHeader: string;
  guardHeader: string;
  adminId: string;
  clientId: string;
  scheduleId: string;
  scheduleStart: string;
  guardId: string;
  cleanup: () => Promise<void>;
}

export const createSupervisionFixture = async (label: string): Promise<ISupervisionFixture> => {
  const stamp = `${label}-${Date.now()}`;
  const admin = await prismaClient.user.findFirst({
    where: { role: { name: ROLE_ADMIN }, active: true },
    select: { id: true, name: true, username: true },
  });
  if (!admin) throw new Error("Se requiere un usuario ADMIN en la base de pruebas (corre el seed)");
  const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD }, select: { id: true } });
  if (!guardRole) throw new Error("Se requiere el rol GUARD en la base de pruebas");

  const now = dayjs().tz(DEFAULT_TIMEZONE);
  const scheduleStart = now.subtract(2, "hour").format("HH:mm");
  const scheduleEnd = now.add(6, "hour").format("HH:mm");

  const client = await prismaClient.client.create({ data: { name: `Cliente Supervisión ${stamp}` } });
  const schedule = await prismaClient.schedule.create({
    data: { name: `Turno Supervisión ${stamp}`, startTime: scheduleStart, endTime: scheduleEnd },
  });
  const guard = await prismaClient.user.create({
    data: {
      name: "Guardia",
      lastName: `Prueba ${label}`,
      username: `guardia.${stamp}`.toLowerCase(),
      password: "x",
      roleId: guardRole.id,
      clientId: client.id,
      scheduleId: schedule.id,
    },
  });

  const header = (payload: Record<string, unknown>) => JSON.stringify(payload);

  return {
    adminHeader: header({ id: admin.id, name: admin.name, username: admin.username, role: ROLE_ADMIN, clientId: null }),
    clientHeader: header({ id: admin.id, name: "Cliente", username: "cliente", role: ROLE_CLIENT, clientId: client.id }),
    guardHeader: header({ id: guard.id, name: guard.name, username: guard.username, role: ROLE_GUARD, clientId: client.id }),
    adminId: admin.id,
    clientId: client.id,
    scheduleId: schedule.id,
    scheduleStart,
    guardId: guard.id,
    cleanup: async () => {
      const handovers = await prismaClient.shiftHandover.findMany({ where: { clientId: client.id }, select: { id: true } });
      await prismaClient.shiftHandoverElement.deleteMany({ where: { shiftHandoverId: { in: handovers.map((h) => h.id) } } });
      await prismaClient.shiftHandover.deleteMany({ where: { clientId: client.id } });
      await prismaClient.uniformCheck.deleteMany({ where: { guardId: guard.id } });
      await prismaClient.shiftPlan.deleteMany({ where: { clientId: client.id } });
      await prismaClient.user.delete({ where: { id: guard.id } });
      await prismaClient.schedule.delete({ where: { id: schedule.id } });
      await prismaClient.client.delete({ where: { id: client.id } });
    },
  };
};

/** Mocks de autenticación: inyectan el usuario del header; `authorize` es real. */
export const authMiddlewareMock = () => {
  const actual = jest.requireActual("@src/modules/common/middlewares/auth.middleware");
  return {
    ...actual,
    authenticate: (req: { headers: Record<string, string> }, res: { locals: Record<string, unknown> }, next: () => void) => {
      if (req.headers["user"]) res.locals.user = JSON.parse(req.headers["user"]);
      next();
    },
  };
};

export const tokenValidatorMock = () => ({
  __esModule: true,
  default: (req: { headers: Record<string, string> }, res: { locals: Record<string, unknown> }, next: () => void) => {
    if (req.headers["user"]) res.locals.user = JSON.parse(req.headers["user"]);
    next();
  },
});
