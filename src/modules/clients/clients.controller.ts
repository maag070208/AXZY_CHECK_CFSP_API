import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import {
  createClient,
  deleteClient,
  getAllClients,
  getClientById,
  getDataTableClients,
  updateClient,
} from "./clients.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createAuditLog } from "../audit/audit.service";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDataTableClients(req.body);
  return res.status(200).json(createTResult(result));
});

export const getClients = asyncHandler(async (req: Request, res: Response) => {
  const clients = await getAllClients();
  return res.status(200).json(createTResult(clients));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getClientById(id);
  return res.status(200).json(createTResult(result));
});

export const addClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await createClient(req.body);

  await createAuditLog({
    userId: res.locals.user?.id || "SYSTEM",
    module: "CLIENTS",
    action: "CREATE",
    resourceId: client.id,
    details: { name: client.name }
  });

  return res.status(201).json(createTResult(client));
});

export const putClient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await updateClient(id, req.body);

  await createAuditLog({
    userId: res.locals.user?.id || id,
    module: "CLIENTS",
    action: "UPDATE",
    resourceId: id,
    details: req.body
  });

  return res.status(200).json(createTResult(client));
});

export const removeClient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await deleteClient(id);

  await createAuditLog({
    userId: res.locals.user?.id || "SYSTEM",
    module: "CLIENTS",
    action: "DELETE",
    resourceId: id
  });

  return res.status(200).json(createTResult(client));
});
