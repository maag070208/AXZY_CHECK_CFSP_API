import type { Message, MulticastMessage } from "firebase-admin/messaging";
import * as Ably from "ably";
import { prismaClient as prisma } from "@src/core/config/database";
import { env } from "@src/core/config/env.config";
import { logger } from "@src/core/utils/logger";
import { getFirebaseApp } from "@src/core/utils/firebase.utils";
import {
  NOTIFICATION_CHANNEL_DEFAULT,
  NOTIFICATION_TYPE_DEFAULT,
  NOTIFICATION_MAX_USERS_BROADCAST,
  NOTIFICATION_MAX_INBOX,
} from "@src/core/config/constants";
import { createAuditLog } from "../audit/audit.service";

let ablyRest: Ably.Rest | null = null;

const getAbly = (): Ably.Rest => {
  if (!ablyRest) {
    ablyRest = new Ably.Rest({ key: env.ABLY_API_KEY });
  }
  return ablyRest;
};

export interface ISendNotificationInput {
  title?: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  channel?: string;
  userId?: string;
  persistent?: boolean;
}

export interface IMyNotificationsResult {
  notifications: unknown[];
  unreadCount: number;
}

export const sendNotification = async (
  input: ISendNotificationInput,
  senderUserId: string,
): Promise<{ sent: boolean; channel: string }> => {
  const {
    title,
    message,
    type = NOTIFICATION_TYPE_DEFAULT,
    channel = NOTIFICATION_CHANNEL_DEFAULT,
    userId,
    persistent = false,
  } = input;

  // 1. Ably (real-time toast en WEB) — best-effort
  try {
    const ably = getAbly();
    const ablyChannel = ably.channels.get(channel);
    await ablyChannel.publish("notification", {
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      persistent,
    });
  } catch (e) {
    logger.warn("[Ably] No se pudo publicar la notificación en tiempo real:", e);
  }

  // 2. Firebase Push Notification — best-effort
  const fcm = getFirebaseApp();
  try {
    if (fcm && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });
      if (user?.fcmToken) {
        const fcmPayload: Message = {
          token: user.fcmToken,
          data: {
            type,
            channel,
            persistent: String(persistent),
            title: title || "",
            message: message || "",
          },
          android: { priority: "high" },
          apns: { payload: { aps: { contentAvailable: true, sound: "default", badge: 1 } } },
        };

        // Firebase auto-display solo para no-persistentes
        if (!persistent) {
          fcmPayload.notification = { title: title || "Notificación", body: message };
          fcmPayload.android = {
            ...fcmPayload.android,
            notification: { channelId: "fansal-default", color: "#10b981" },
          };
        }

        await fcm.messaging().send(fcmPayload);
      }
    }

    // 3. Broadcast a todos si no hay userId específico
    if (fcm && !userId) {
      const users = await prisma.user.findMany({
        where: { fcmToken: { not: null }, active: true, softDelete: false },
        select: { fcmToken: true },
        take: NOTIFICATION_MAX_USERS_BROADCAST,
      });
      const tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
      if (tokens.length > 0) {
        const fcmPayload: MulticastMessage = {
          tokens,
          data: {
            type,
            channel,
            persistent: String(persistent),
            title: title || "",
            message: message || "",
          },
          android: { priority: "high" },
          apns: { payload: { aps: { contentAvailable: true, sound: "default", badge: 1 } } },
        };

        if (!persistent) {
          fcmPayload.notification = { title: title || "Notificación", body: message };
          fcmPayload.android = {
            ...fcmPayload.android,
            notification: { channelId: "fansal-default", color: "#10b981" },
          };
        }

        await fcm.messaging().sendEachForMulticast(fcmPayload);
      }
    }
  } catch (e) {
    logger.warn("[FCM] No se pudo enviar la notificación push:", e);
  }

  // 4. Guardar en NotificationLog si es persistente
  if (persistent && userId) {
    await prisma.notificationLog.create({
      data: {
        userId,
        title: title || null,
        message,
        type,
      },
    });
  }

  await createAuditLog({
    userId: senderUserId,
    module: "NOTIFICATIONS",
    action: "SEND",
    details: { channel, persistent, title, userId },
  });

  return { sent: true, channel };
};

export const getMyNotifications = async (
  userId: string,
  unreadOnly: boolean,
): Promise<IMyNotificationsResult> => {
  const where = { userId, ...(unreadOnly ? { read: false } : {}) };

  const notifications = await prisma.notificationLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: NOTIFICATION_MAX_INBOX,
  });

  const unreadCount = await prisma.notificationLog.count({
    where: { userId, read: false },
  });

  return { notifications, unreadCount };
};

export const markAsRead = async (id: string): Promise<void> => {
  await prisma.notificationLog.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });
};

export const markAllAsRead = async (userId: string): Promise<void> => {
  await prisma.notificationLog.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
};
