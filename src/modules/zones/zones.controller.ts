import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as zonesService from "./zones.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const getZonesDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await zonesService.getZonesDataTable(req.body);
  return res.status(200).json(createTResult(result));
});

export const getZones = asyncHandler(async (req: Request, res: Response) => {
  const { clientId } = req.params;
  const result = await zonesService.getZonesByClient(clientId);
  return res.status(200).json(createTResult(result));
});

export const addZone = asyncHandler(async (req: Request, res: Response) => {
  const result = await zonesService.createZone(req.body);
  return res.status(201).json(createTResult(result));
});

export const putZone = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await zonesService.updateZone(id, req.body);
  return res.status(200).json(createTResult(result));
});

export const removeZone = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await zonesService.deleteZone(id);
  return res.status(200).json(createTResult(result));
});
