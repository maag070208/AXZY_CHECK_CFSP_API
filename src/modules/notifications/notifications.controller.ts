import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import * as Ably from "ably";

const ABLY_KEY = process.env.ABLY_API_KEY || "_iYGPA.fJVkAw:ix6oVHub7TpqllbX6JMdmfJgDoqKKEIoZ5wJNRo6Zlc";

let ablyRest: Ably.Rest | null = null;

const getAbly = (): Ably.Rest => {
  if (!ablyRest) {
    ablyRest = new Ably.Rest({ key: ABLY_KEY });
  }
  return ablyRest;
};

export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, type, channel } = req.body;

  const ably = getAbly();
  const ablyChannel = ably.channels.get(channel);

  await ablyChannel.publish("notification", {
    title,
    message,
    type,
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json(
    createTResult({ sent: true, channel })
  );
});
