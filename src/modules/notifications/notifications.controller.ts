import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { AuthenticatedUser } from "@src/core/types/auth.types";
import { sendNotification as sendNotificationService } from "./notifications.service";

export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  const senderUserId = (res.locals.user as AuthenticatedUser).id;
  const result = await sendNotificationService(req.body, senderUserId);
  return res.status(200).json(createTResult(result));
});
