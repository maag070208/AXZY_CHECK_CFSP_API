import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const helloWorld = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    createTResult({
      message: "Hello World",
    })
  );
});
