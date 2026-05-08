import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as locationsService from "./locations.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await locationsService.getDataTableLocations(req.body);
  return res.status(200).json(createTResult(result));
});

export const getLocations = asyncHandler(async (req: Request, res: Response) => {
  const { clientId } = req.query;
  const locations = await locationsService.getAllLocations(clientId as string);
  return res.status(200).json(createTResult(locations));
});

export const addLocation = asyncHandler(async (req: Request, res: Response) => {
  const { clientId, name, zoneId, aisle, spot, number } = req.body;
  
  const locationData = { 
      clientId: clientId, 
      zoneId: zoneId || undefined,
      aisle: aisle || '', 
      spot: spot || '', 
      number: number || '', 
      name 
  };

  const location = await locationsService.createLocation(locationData);
  return res.status(201).json(createTResult(location));
});

export const putLocation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, zoneId, aisle, spot, number, name, active } = req.body;
  
  const location = await locationsService.updateLocation(id, { 
      clientId: clientId || undefined, 
      zoneId: zoneId || undefined,
      aisle, 
      spot, 
      number, 
      name,
      active
  });
  return res.status(200).json(createTResult(location));
});

export const removeLocation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const location = await locationsService.deleteLocation(id);
  return res.status(200).json(createTResult(location));
});

export const printBulkQR = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new AppError("Debes proporcionar una lista de IDs", 400);
  }
  const buffer: any = await locationsService.generateQRPDF(ids);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=qrs.pdf');
  return res.send(buffer);
});
