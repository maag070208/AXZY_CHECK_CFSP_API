import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import { createClient, deleteClient, getAllClients, getDataTableClients, updateClient } from "./clients.service";

export const getDataTable = async (req: Request, res: Response) => {
  try {
    const result = await getDataTableClients(req.body);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const getClients = async (req: Request, res: Response) => {
  try {
    const clients = await getAllClients();
    return res.status(200).json(createTResult(clients));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const addClient = async (req: Request, res: Response) => {
  try {
    const client = await createClient(req.body);
    return res.status(201).json(createTResult(client));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const putClient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const client = await updateClient(Number(id), req.body);
        return res.status(200).json(createTResult(client));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message));
    }
};

export const removeClient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const client = await deleteClient(Number(id));
        return res.status(200).json(createTResult(client));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message || "Error eliminando cliente"));
    }
};
