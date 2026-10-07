import type { Message } from "firebase-admin/messaging";
import * as Ably from "ably";
import { ScheduledNotification } from "@prisma/client";
import { prismaClient as prisma } from "@src/core/config/database";
import { env } from "@src/core/config/env.config";
import { logger } from "@src/core/utils/logger";
import { getFirebaseApp } from "@src/core/utils/firebase.utils";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { createAuditLog } from "../audit/audit.service";
import { IScheduledCreate, IScheduledUpdate } from "./schemas/scheduled.schema";

export const getDataTable = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<ScheduledNotification>> => {
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

export const create = async (data: IScheduledCreate, userId: string) => {
  const nextSend = computeNextSend(data);
  const record = await prisma.scheduledNotification.create({
    data: { ...data, nextSendAt: nextSend },
  });

  await createAuditLog({
    userId,
    module: "SCHEDULED_NOTIFICATIONS",
    action: "CREATE",
    resourceId: record.id,
    details: { title: data.title, frequency: data.frequency },
  });

  // Si es ONE-TIME y ya venció, se despacha de inmediato y se cierra.
  if (data.frequency === "ONCE" && (!data.scheduledAt || new Date(data.scheduledAt) <= new Date())) {
    try {
      await dispatchNotification(record);
      await markAsSent(record.id, null);
      await disableCompleted(record.id);
    } catch (e) {
      logger.warn("[Scheduled] No se pudo despachar la notificación inmediata:", e);
    }
  }

  return record;
};

export const update = async (id: string, data: IScheduledUpdate & { nextSendAt?: Date | null }, userId: string) => {
  if (data.frequency !== undefined || data.timeOfDay !== undefined) {
    const existing = await prisma.scheduledNotification.findUnique({ where: { id } });
    const merged = { ...existing, ...data };
    data.nextSendAt = computeNextSend(merged);
  }
  const record = await prisma.scheduledNotification.update({ where: { id }, data });

  await createAuditLog({
    userId,
    module: "SCHEDULED_NOTIFICATIONS",
    action: "UPDATE",
    resourceId: id,
  });

  return record;
};

export const remove = async (id: string, userId: string) => {
  const record = await prisma.scheduledNotification.delete({ where: { id } });

  await createAuditLog({
    userId,
    module: "SCHEDULED_NOTIFICATIONS",
    action: "DELETE",
    resourceId: id,
  });

  return record;
};

export const getDueNotifications = async () => {
  const now = new Date();
  return prisma.scheduledNotification.findMany({
    where: {
      active: true,
      nextSendAt: { lte: now },
      OR: [
        { maxSends: null },
        { sendCount: { lt: prisma.scheduledNotification.fields.maxSends } },
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

export interface IDispatchNotificationInput {
  title: string | null;
  message: string;
  type: string;
  channel: string;
  persistent: boolean;
  userId: string | null;
}

/**
 * Despacha una notificación programada: publica en Ably (tiempo real) y, si hay
 * destinatario, envía el push FCM. Todo best-effort: los errores se registran y
 * no revientan el flujo.
 */
export const dispatchNotification = async (notif: IDispatchNotificationInput): Promise<void> => {
  // 1. Ably
  try {
    const ably = new Ably.Rest({ key: env.ABLY_API_KEY });
    const ch = ably.channels.get(notif.channel || "global");
    await ch.publish("notification", {
      title: notif.title,
      message: notif.message,
      type: notif.type,
      timestamp: new Date().toISOString(),
      persistent: notif.persistent,
    });
  } catch (e) {
    logger.warn("[Scheduled] No se pudo publicar en Ably:", e);
  }

  // 2. FCM
  if (notif.userId) {
    try {
      const fcm = getFirebaseApp();
      if (fcm) {
        const user = await prisma.user.findUnique({
          where: { id: notif.userId },
          select: { fcmToken: true },
        });
        if (user?.fcmToken) {
          const payload: Message = {
            token: user.fcmToken,
            data: {
              type: notif.type,
              persistent: String(notif.persistent),
              title: notif.title || "",
              message: notif.message,
            },
            android: { priority: "high" },
            apns: { payload: { aps: { contentAvailable: true, sound: "default", badge: 1 } } },
          };
          if (!notif.persistent) {
            payload.notification = { title: notif.title || "Notificación", body: notif.message };
            payload.android = {
              ...payload.android,
              notification: { channelId: "fansal-default", color: "#10b981" },
            };
          }
          await fcm.messaging().send(payload);
        }
      }
    } catch (e) {
      logger.warn("[Scheduled] No se pudo enviar el push FCM:", e);
    }
  }
};

export function computeNextSend(data: {
  frequency?: string | null;
  timeOfDay?: string | null;
  scheduledAt?: string | Date | null;
  daysOfWeek?: string | null;
}): Date | null {
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
