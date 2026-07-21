import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { prismaClient as prisma } from "@src/core/config/database";
import * as Ably from "ably";
import * as service from "./scheduled.service";

const ABLY_KEY = process.env.ABLY_API_KEY || "_iYGPA.fJVkAw:ix6oVHub7TpqllbX6JMdmfJgDoqKKEIoZ5wJNRo6Zlc";

async function sendNow(notif: any) {
  const ably = new Ably.Rest({ key: ABLY_KEY });
  const ch = ably.channels.get(notif.channel || "global");
  await ch.publish("notification", {
    title: notif.title,
    message: notif.message,
    type: notif.type,
    timestamp: new Date().toISOString(),
    persistent: notif.persistent,
  });

  if (notif.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: notif.userId },
        select: { fcmToken: true },
      });
      if (user?.fcmToken) {
        const admin = require("firebase-admin");
        const fcm = admin.apps.length ? admin.apps[0] : null;
        if (fcm) {
          const payload: any = {
            token: user.fcmToken,
            data: { type: notif.type, persistent: String(notif.persistent || false), title: notif.title || "", message: notif.message },
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
    } catch (e) {}
  }
}

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getDataTable(req.body);
  return res.status(200).json(createTResult(result));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const record = await service.getById(req.params.id);
  return res.status(200).json(createTResult(record));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await service.create(req.body);

  const { frequency, scheduledAt } = req.body;
  if (frequency === "ONCE" && (!scheduledAt || new Date(scheduledAt) <= new Date())) {
    try {
      await sendNow(record);
      await service.markAsSent(record.id, null);
      await service.disableCompleted(record.id);
    } catch (e) {}
  }

  return res.status(201).json(createTResult(record));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const record = await service.update(req.params.id, req.body);
  return res.status(200).json(createTResult(record));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req.params.id);
  return res.status(200).json(createTResult(true));
});
