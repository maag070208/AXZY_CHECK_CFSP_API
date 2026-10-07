import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { AuthenticatedUser } from "@src/core/types/auth.types";
import {
  getMyNotifications as getMyNotificationsService,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from "./notifications.service";

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = (res.locals.user as AuthenticatedUser).id;
  const unreadOnly = req.query.unreadOnly === "true";
  const result = await getMyNotificationsService(userId, unreadOnly);
  return res.status(200).json(createTResult(result));
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await markAsReadService(req.params.id);
  return res.status(200).json(createTResult(true));
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (res.locals.user as AuthenticatedUser).id;
  await markAllAsReadService(userId);
  return res.status(200).json(createTResult(true));
});
