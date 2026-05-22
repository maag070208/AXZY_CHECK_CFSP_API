import { createAuditLog } from "@src/modules/audit/audit.service";
import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import {
  CreateReportConfigurationDTO,
  UpdateReportConfigurationDTO,
} from "./report-configurations.dto";
import {
  createReportConfiguration,
  deleteReportConfiguration,
  getReportConfigurations,
  updateReportConfiguration,
} from "./report-configurations.service";

export const getConfigurations = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.body.page as string) || 1;
  const limit = parseInt(req.body.limit as string) || 10;
  const searchTerm = req.body.searchTerm as string;

  const result = await getReportConfigurations(page, limit, searchTerm);
  res.status(result.success ? 200 : 500).json(result);
});

export const createConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const data: CreateReportConfigurationDTO = req.body;
  const result = await createReportConfiguration(data);

  if (result.success) {
    await createAuditLog({
      userId: res.locals.user?.id || "SYSTEM",
      module: "REPORT_CONFIGURATIONS",
      action: "CREATE",
      resourceId: result.data.id,
      details: `Created configuration: ${data.name}`,
    });
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

export const updateConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const data: UpdateReportConfigurationDTO = req.body;

  const result = await updateReportConfiguration(id, data);

  if (result.success) {
    await createAuditLog({
      userId: res.locals.user?.id || "SYSTEM",
      module: "REPORT_CONFIGURATIONS",
      action: "UPDATE",
      resourceId: result.data.id,
      details: `Updated configuration: ${result.data.name}`,
    });
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

export const deleteConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;

  const result = await deleteReportConfiguration(id);

  if (result.success) {
    await createAuditLog({
      userId: res.locals.user?.id || "SYSTEM",
      module: "REPORT_CONFIGURATIONS",
      action: "DELETE",
      resourceId: id,
      details: `Deleted configuration: ${id}`,
    });
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});
