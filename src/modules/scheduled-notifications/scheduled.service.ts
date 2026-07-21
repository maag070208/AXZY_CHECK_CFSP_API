import { prismaClient as prisma } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";

export const getDataTable = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
  const prismaParams = getPrismaPaginationParams(params);
  const search = params.filters?.search;

  if (search) {
    prismaParams.where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
    ];
  }

  if (params.filters?.status === "active") {
    prismaParams.where.active = true;
  } else if (params.filters?.status === "inactive") {
    prismaParams.where.active = false;
  }

  const [rows, total] = await Promise.all([
    prisma.scheduledNotification.findMany({
      ...prismaParams,
      include: {
        targetUser: { select: { id: true, name: true, lastName: true } },
      },
      orderBy: prismaParams.orderBy || { createdAt: "desc" },
    }),
    prisma.scheduledNotification.count({ where: prismaParams.where }),
  ]);

  return { rows, total };
};

export const getById = async (id: string) => {
  return prisma.scheduledNotification.findUnique({
    where: { id },
    include: { targetUser: { select: { id: true, name: true, lastName: true } } },
  });
};

export const create = async (data: any) => {
  const nextSend = computeNextSend(data);
  return prisma.scheduledNotification.create({
    data: { ...data, nextSendAt: nextSend },
  });
};

export const update = async (id: string, data: any) => {
  if (data.frequency !== undefined || data.timeOfDay !== undefined) {
    const existing = await prisma.scheduledNotification.findUnique({ where: { id } });
    const merged = { ...existing, ...data };
    data.nextSendAt = computeNextSend(merged);
  }
  return prisma.scheduledNotification.update({ where: { id }, data });
};

export const remove = async (id: string) => {
  return prisma.scheduledNotification.delete({ where: { id } });
};

export const getDueNotifications = async () => {
  const now = new Date();
  return prisma.scheduledNotification.findMany({
    where: {
      active: true,
      nextSendAt: { lte: now },
      OR: [
        { maxSends: null },
        { sendCount: { lt: prisma.scheduledNotification.fields.maxSends as any } },
      ],
    },
  });
};

export const markAsSent = async (id: string, nextSendAt: Date | null) => {
  return prisma.scheduledNotification.update({
    where: { id },
    data: {
      sendCount: { increment: 1 },
      lastSentAt: new Date(),
      nextSendAt,
    },
  });
};

export const disableCompleted = async (id: string) => {
  return prisma.scheduledNotification.update({
    where: { id },
    data: { active: false },
  });
};

export function computeNextSend(data: any): Date | null {
  const { frequency, timeOfDay, scheduledAt, daysOfWeek } = data;
  const now = new Date();

  if (frequency === "ONCE" || !frequency) {
    return scheduledAt ? new Date(scheduledAt) : null;
  }

  const [h, m] = (timeOfDay || "08:00").split(":").map(Number);
  let next = new Date();
  next.setHours(h, m, 0, 0);

  if (frequency === "DAILY") {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === "EVERY_2_DAYS") {
    if (next <= now) next.setDate(next.getDate() + 1);
    // Ensure it's an even offset from epoch
    while (Math.floor(next.getTime() / 86400000) % 2 !== 0) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (frequency === "EVERY_2_WEEKS") {
    next.setDate(next.getDate() + ((1 - next.getDay() + 14) % 14));
    if (next <= now) next.setDate(next.getDate() + 14);
    return next;
  }

  if (frequency === "MONTHLY") {
    next.setDate(1);
    next.setMonth(next.getMonth() + (next <= now ? 1 : 0));
    return next;
  }

  if (frequency === "WEEKLY" && daysOfWeek) {
    const days = daysOfWeek.split(",").map(Number);
    const today = now.getDay();
    const sorted = days.sort((a: number, b: number) => a - b);
    let found = sorted.find((d: number) => d > today);
    if (!found) found = sorted[0];
    const diff = found > today ? found - today : 7 - today + found;
    next = new Date(now);
    next.setDate(next.getDate() + diff);
    next.setHours(h, m, 0, 0);
    return next;
  }

  return next;
}
