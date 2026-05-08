import { Request, Response } from "express";
import * as SettingsService from "./settings.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";

// Incident Categories
export const getPaginatedIncidentCategories = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.getPaginatedIncidentCategories(req.body);
    res.status(200).json(createTResult(data));
});

export const createIncidentCategory = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.createIncidentCategory(req.body);
    res.status(201).json(createTResult(data));
});

export const updateIncidentCategory = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.updateIncidentCategory(req.params.id, req.body);
    res.status(200).json(createTResult(data));
});

export const deleteIncidentCategory = asyncHandler(async (req: Request, res: Response) => {
    await SettingsService.deleteIncidentCategory(req.params.id);
    res.status(200).json(createTResult(true));
});

// Incident Types
export const getPaginatedIncidentTypes = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.getPaginatedIncidentTypes(req.body);
    res.status(200).json(createTResult(data));
});

export const createIncidentType = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.createIncidentType(req.body);
    res.status(201).json(createTResult(data));
});

export const updateIncidentType = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.updateIncidentType(req.params.id, req.body);
    res.status(200).json(createTResult(data));
});

export const deleteIncidentType = asyncHandler(async (req: Request, res: Response) => {
    await SettingsService.deleteIncidentType(req.params.id);
    res.status(200).json(createTResult(true));
});

// SysConfig
export const getPaginatedSysConfig = asyncHandler(async (req: Request, res: Response) => {
    const data = await SettingsService.getPaginatedSysConfig(req.body);
    res.status(200).json(createTResult(data));
});

export const updateSysConfig = asyncHandler(async (req: Request, res: Response) => {
    const { key, value } = req.body;
    const data = await SettingsService.updateSysConfig(key, value);
    res.status(200).json(createTResult(data));
});

export const deleteSysConfig = asyncHandler(async (req: Request, res: Response) => {
    await SettingsService.deleteSysConfig(req.params.key);
    res.status(200).json(createTResult(true));
});
