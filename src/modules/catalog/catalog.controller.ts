import { Request, Response } from "express";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import * as catalogService from './catalog.service';
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const getCatalog = asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const result = await catalogService.getCatalog(key);
    return res.status(200).json(createTResult(result));
});
