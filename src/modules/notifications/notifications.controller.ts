import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { prismaClient as prisma } from "@src/core/config/database";
import * as Ably from "ably";

const ABLY_KEY = process.env.ABLY_API_KEY || "_iYGPA.fJVkAw:ix6oVHub7TpqllbX6JMdmfJgDoqKKEIoZ5wJNRo6Zlc";

let ablyRest: Ably.Rest | null = null;

const getAbly = (): Ably.Rest => {
  if (!ablyRest) {
    ablyRest = new Ably.Rest({ key: ABLY_KEY });
  }
  return ablyRest;
};

// Firebase Admin - requires service account JSON
let firebaseApp: any = null;
const getFirebase = () => {
  if (!firebaseApp) {
    try {
      const admin = require("firebase-admin");
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : require("@src/../axzyfansalcheck-firebase-adminsdk-fbsvc-a3b898be27.json");
      firebaseApp = admin.apps.length
        ? admin.apps[0]
        : admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
    } catch (e) {
      console.warn("[FCM] Firebase Admin no configurado:", e);
    }
  }
  return firebaseApp;
};

export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type, channel, userId, persistent } = req.body;

  // 1. Ably (real-time toast en WEB)
  const ably = getAbly();
  const ablyChannel = ably.channels.get(channel || "global");
  await ablyChannel.publish("notification", {
    title,
    message,
    type,
    timestamp: new Date().toISOString(),
    persistent: persistent || false,
  });

  // 2. Firebase Push Notification
  const fcm = getFirebase();
  if (fcm && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (user?.fcmToken) {
      const fcmPayload: any = {
        token: user.fcmToken,
        data: {
          type: type || "info",
          channel: channel || "global",
          persistent: String(persistent || false),
          title: title || "",
          message: message || "",
        },
        android: { priority: "high" },
        apns: { payload: { aps: { contentAvailable: true, sound: "default", badge: 1 } } },
      };

      // Firebase auto-display solo para no-persistentes
      if (!persistent) {
        fcmPayload.notification = { title: title || "Notificación", body: message };
        fcmPayload.android.notification = { channelId: "fansal-default", color: "#10b981" };
      }

      await fcm.messaging().send(fcmPayload);
    }
  }

  // 3. Broadcast a todos si no hay userId específico
  if (fcm && !userId) {
    const users = await prisma.user.findMany({
      where: { fcmToken: { not: null }, active: true, softDelete: false },
      select: { fcmToken: true },
      take: 500,
    });
    const tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
    if (tokens.length > 0) {
      const fcmPayload: any = {
        tokens,
        data: {
          type: type || "info",
          channel: channel || "global",
          persistent: String(persistent || false),
          title: title || "",
          message: message || "",
        },
        android: { priority: "high" },
        apns: { payload: { aps: { contentAvailable: true, sound: "default", badge: 1 } } },
      };

      if (!persistent) {
        fcmPayload.notification = { title: title || "Notificación", body: message };
        fcmPayload.android.notification = { channelId: "fansal-default", color: "#10b981" };
      }

      await fcm.messaging().sendEachForMulticast(fcmPayload);
    }
  }

  // 4. Guardar en NotificationLog si es persistente
  if (persistent && userId) {
    await prisma.notificationLog.create({
      data: {
        userId,
        title: title || null,
        message,
        type: type || "info",
      },
    });
  }

  return res.status(200).json(createTResult({ sent: true, channel }));
});
