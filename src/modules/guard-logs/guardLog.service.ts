import { prismaClient } from "@src/core/config/database";
import { now } from "@src/core/utils/date-time.utils";
import { AppError } from "@src/core/errors/AppError";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { OPERATIONAL_ROLES } from "@src/core/config/constants";
import { IGuardLoginLogResponse } from "./guardLog.response";
import { createAuditLog } from "../audit/audit.service";

const prisma = prismaClient;

export const clockIn = async (guardId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: guardId },
    include: { role: true },
  });

  if (!user || !OPERATIONAL_ROLES.includes(user.role.name)) {
    throw new AppError("El usuario no es un guardia operativo", 400);
  }

  const log = await prisma.guardLoginLog.create({
    data: { userId: guardId },
    include: {
      user: { select: { id: true, name: true, lastName: true, username: true } },
    },
  });

  await createAuditLog({
    userId: guardId,
    module: "GUARD_LOGS",
    action: "CLOCK_IN",
    resourceId: log.id,
  });

  return log;
};

export const clockOut = async (guardId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: guardId },
    include: { role: true },
  });

  if (!user || !OPERATIONAL_ROLES.includes(user.role.name)) {
    throw new AppError("El usuario no es un guardia operativo", 400);
  }

  const openLog = await prisma.guardLoginLog.findFirst({
    where: { userId: guardId, logoutAt: null },
    orderBy: { loginAt: "desc" },
  });

  if (!openLog) {
    throw new AppError("No hay una entrada abierta para este guardia", 400);
  }

  const log = await prisma.guardLoginLog.update({
    where: { id: openLog.id },
    data: { logoutAt: now() },
    include: {
      user: { select: { id: true, name: true, lastName: true, username: true } },
    },
  });

  await createAuditLog({
    userId: guardId,
    module: "GUARD_LOGS",
    action: "CLOCK_OUT",
    resourceId: log.id,
  });

  return log;
};

const mapGuardLogFilters = (filters: Record<string, any>) => {
  const where: any = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "" || key === "refreshKey") continue;

    if (key === "date") {
      if (Array.isArray(value) && value[0]) {
        where.loginAt = { gte: new Date(value[0]) };
        if (value[1]) {
          where.loginAt.lte = new Date(value[1]);
        }
      }
      continue;
    }

    if (key === "search") {
      where.user = {
        ...(where.user || {}),
        OR: [
          { name: { contains: value, mode: "insensitive" } },
          { lastName: { contains: value, mode: "insensitive" } },
          { username: { contains: value, mode: "insensitive" } },
        ],
      };
      continue;
    }

    if (key === "isOpen") {
      where.logoutAt = value === true ? null : { not: null };
      continue;
    }

    if (key === "clientId") {
      where.user = {
        ...(where.user || {}),
        clientId: value,
      };
      continue;
    }

    if (typeof value === "string") {
      if (key.toLowerCase().endsWith("id")) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          where[key] = numValue;
          continue;
        }
      }
      const isStatusOrRole = ["status", "role", "type", "category"].includes(key.toLowerCase());
      const isEnumPattern = /^[A-Z_]+$/.test(value);
      if (isStatusOrRole && isEnumPattern) {
        where[key] = value;
        continue;
      }
      where[key] = { contains: value, mode: "insensitive" };
    } else {
      where[key] = value;
    }
  }

  return where;
};

export const deleteLog = async (id: string) => {
  const log = await prisma.guardLoginLog.findUnique({ where: { id } });
  if (!log) {
    throw new AppError("Registro de prenómina no encontrado", 404);
  }

  await prisma.guardLoginLog.delete({ where: { id } });

  await createAuditLog({
    userId: log.userId,
    module: "GUARD_LOGS",
    action: "DELETE",
    resourceId: id,
  });

  return { id };
};

export const getDataTable = async (
  params: ITDataTableFetchParams,
): Promise<ITDataTableResponse<IGuardLoginLogResponse>> => {
  const prismaParams = getPrismaPaginationParams(params);

  const mappedWhere = mapGuardLogFilters(params.filters || {});

  const where = { ...mappedWhere };

  const [rows, total] = await Promise.all([
    prisma.guardLoginLog.findMany({
      skip: prismaParams.skip,
      take: prismaParams.take,
      orderBy: prismaParams.orderBy,
      where,
      select: {
        id: true,
        userId: true,
        loginAt: true,
        logoutAt: true,
        user: {
          select: { id: true, name: true, lastName: true, username: true },
        },
      },
    }),
    prisma.guardLoginLog.count({ where }),
  ]);

  return { rows: rows as IGuardLoginLogResponse[], total };
};
