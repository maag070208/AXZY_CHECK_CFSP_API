import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as zonesService from "./zones.service";

export const getZonesDataTable = async (req: Request, res: Response) => {
  try {
    const result = await zonesService.getZonesDataTable(req.body);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, [error.message]));
  }
};

export const getZones = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const result = await zonesService.getZonesByClient(clientId);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, [error.message]));
  }
};

export const addZone = async (req: Request, res: Response) => {
  try {
    const result = await zonesService.createZone(req.body);
    return res.status(201).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, [error.message]));
  }
};

export const putZone = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await zonesService.updateZone(id, req.body);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};

export const removeZone = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await zonesService.deleteZone(id);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};
