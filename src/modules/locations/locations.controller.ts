import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as locationsService from "./locations.service";

export const getDataTable = async (req: Request, res: Response) => {
  try {
    const result = await locationsService.getDataTableLocations(req.body);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const getLocations = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const locations = await locationsService.getAllLocations(clientId as string);
    return res.status(200).json(createTResult(locations));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const addLocation = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const putLocation = async (req: Request, res: Response) => {
    try {
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
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message));
    }
};

export const removeLocation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const location = await locationsService.deleteLocation(id);
        return res.status(200).json(createTResult(location));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message || "Error eliminando zona"));
    }
};

export const printBulkQR = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json(createTResult(null, ["Debes proporcionar una lista de IDs"]));
        }
        const buffer: any = await locationsService.generateQRPDF(ids);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=qrs.pdf');
        return res.send(buffer);
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};
