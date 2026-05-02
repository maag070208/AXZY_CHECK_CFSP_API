import { Request, Response } from "express";
import * as SettingsService from "./settings.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";

// Incident Categories
export const getPaginatedIncidentCategories = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.getPaginatedIncidentCategories(req.body);
        res.status(200).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const createIncidentCategory = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.createIncidentCategory(req.body);
        res.status(201).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const updateIncidentCategory = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.updateIncidentCategory(Number(req.params.id), req.body);
        res.status(200).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const deleteIncidentCategory = async (req: Request, res: Response) => {
    try {
        await SettingsService.deleteIncidentCategory(Number(req.params.id));
        res.status(200).json(createTResult(true));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

// Incident Types
export const getPaginatedIncidentTypes = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.getPaginatedIncidentTypes(req.body);
        res.status(200).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const createIncidentType = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.createIncidentType(req.body);
        res.status(201).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const updateIncidentType = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.updateIncidentType(Number(req.params.id), req.body);
        res.status(200).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const deleteIncidentType = async (req: Request, res: Response) => {
    try {
        await SettingsService.deleteIncidentType(Number(req.params.id));
        res.status(200).json(createTResult(true));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

// SysConfig
export const getPaginatedSysConfig = async (req: Request, res: Response) => {
    try {
        const data = await SettingsService.getPaginatedSysConfig(req.body);
        res.status(200).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const updateSysConfig = async (req: Request, res: Response) => {
    try {
        const { key, value } = req.body;
        const data = await SettingsService.updateSysConfig(key, value);
        res.status(200).json(createTResult(data));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};

export const deleteSysConfig = async (req: Request, res: Response) => {
    try {
        await SettingsService.deleteSysConfig(req.params.key);
        res.status(200).json(createTResult(true));
    } catch (error: any) {
        res.status(500).json(createTResult(null, [error.message]));
    }
};
