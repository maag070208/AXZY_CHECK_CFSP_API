import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { prismaClient as prisma } from "@src/core/config/database";

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const { unreadOnly } = req.query;

  const where: any = { userId };
  if (unreadOnly === "true") where.read = false;

  const notifications = await prisma.notificationLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = await prisma.notificationLog.count({
    where: { userId, read: false },
  });

  return res.status(200).json(createTResult({ notifications, unreadCount }));
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.notificationLog.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });
  return res.status(200).json(createTResult(true));
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  await prisma.notificationLog.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return res.status(200).json(createTResult(true));
});
