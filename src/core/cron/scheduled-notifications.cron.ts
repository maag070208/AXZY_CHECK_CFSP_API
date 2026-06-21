import { getDueNotifications, markAsSent, disableCompleted, computeNextSend } from "../../modules/scheduled-notifications/scheduled.service";
import { prismaClient as prisma } from "@src/core/config/database";
import { logger } from "@src/core/utils/logger";
import * as Ably from "ably";

const ABLY_KEY = process.env.ABLY_API_KEY || "_iYGPA.fJVkAw:ix6oVHub7TpqllbX6JMdmfJgDoqKKEIoZ5wJNRo6Zlc";

let intervalId: NodeJS.Timeout | null = null;

export const startScheduledNotificationProcessor = (intervalMs = 60000) => {
  if (intervalId) return;

  logger.info("[Scheduler] Iniciando procesador de notificaciones programadas");

  intervalId = setInterval(async () => {
    try {
      await processDueNotifications();
    } catch (error) {
      logger.error("[Scheduler] Error procesando notificaciones:", error);
    }
  }, intervalMs);

  processDueNotifications().catch((e) =>
    logger.error("[Scheduler] Error inicial:", e)
  );
};

async function processDueNotifications() {
  const dueList = await getDueNotifications();
  if (dueList.length === 0) return;

  logger.info(`[Scheduler] Encontradas ${dueList.length} notificaciones pendientes`);

  for (const notif of dueList) {
    try {
      await sendNotificationDirect(notif);

      let nextSend: Date | null = null;
      if (notif.frequency && notif.frequency !== "ONCE") {
        nextSend = computeNextSend({
          ...notif,
          scheduledAt: new Date().toISOString(),
        });
      }

      if (notif.maxSends && notif.sendCount + 1 >= notif.maxSends) {
        await disableCompleted(notif.id);
      } else if (!nextSend) {
        await disableCompleted(notif.id);
      } else {
        await markAsSent(notif.id, nextSend);
      }

      logger.info(`[Scheduler] Notificación enviada: ${notif.id}`);
    } catch (error) {
      logger.error(`[Scheduler] Error enviando ${notif.id}:`, error);
    }
  }
}

async function sendNotificationDirect(notif: any) {
  const ably = new Ably.Rest({ key: ABLY_KEY });
  const ch = ably.channels.get(notif.channel || "global");
  await ch.publish("notification", {
    title: notif.title,
    message: notif.message,
    type: notif.type,
    timestamp: new Date().toISOString(),
    persistent: notif.persistent,
    scheduledId: notif.id,
  });

  // Guardar en NotificationLog si es persistente y tiene userId
  if (notif.persistent && notif.userId) {
    try {
      await prisma.notificationLog.create({
        data: {
          userId: notif.userId,
          title: notif.title || null,
          message: notif.message,
          type: notif.type,
        },
      });
    } catch (e) {
      logger.warn("[Scheduler] Error guardando notificación persistente:", e);
    }
  }

  if (notif.userId) {
    try {
      const admin = require("firebase-admin");
      const fcm = admin.apps.length ? admin.apps[0] : null;
      if (fcm) {
        const user = await prisma.user.findUnique({
          where: { id: notif.userId },
          select: { fcmToken: true },
        });
        if (user?.fcmToken) {
          const payload: any = {
            token: user.fcmToken,
            data: { type: notif.type, persistent: String(notif.persistent || false), channel: notif.channel || "global" },
            android: { priority: "high" },
            apns: { payload: { aps: { contentAvailable: true, sound: "default", badge: 1 } } },
          };
          if (!notif.persistent) {
            payload.notification = { title: notif.title || "Notificación", body: notif.message };
            payload.android.notification = { channelId: "fansal-default", color: "#10b981" };
          }
          await fcm.messaging().send(payload);
        }
      }
    } catch (e) {
      logger.warn("[Scheduler] FCM no disponible:", e);
    }
  }
}
