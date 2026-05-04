import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as recurringService from "./recurring.service";

export const getDataTable = async (req: Request, res: Response) => {
  try {
    const result = await recurringService.getRecurringDataTable(req.body);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, [error.message]));
  }
};

export const postRecurring = async (req: Request, res: Response) => {
  try {
    const result = await recurringService.createRecurring(req.body);
    return res.status(201).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, [error.message]));
  }
};

export const putRecurring = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await recurringService.updateRecurring(id, req.body);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};

export const deleteRecurring = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await recurringService.deleteRecurring(id);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, [error.message]));
  }
};

export const getRecurring = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await recurringService.getRecurringById(id);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};

export const getRecurringByGuard = async (req: Request, res: Response) => {
    try {
        const { guardId } = req.params;
        const result = await recurringService.getRecurringByGuard(guardId);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};

export const getAllRecurring = async (req: Request, res: Response) => {
    try {
        const result = await recurringService.getAllRecurring();
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, [error.message]));
    }
};

