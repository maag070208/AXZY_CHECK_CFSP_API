import { z } from "zod";
import { ChecklistAnswer } from "@src/core/utils/checklist.utils";
import { IClientSummary, IPersonSummary, IScheduleSummary } from "../shift-plans/shift-plan.dto";
import { createUniformCheckSchema } from "./schemas/uniform-check.schema";

export type CreateUniformCheckDTO = z.infer<typeof createUniformCheckSchema>["body"];

/** Filtros aceptados por `POST /uniform-checks/datatable`. */
export interface IUniformCheckFilters {
  clientId?: string;
  guardId?: string;
  /** "true" | "false" desde el filtro triple de WEB. */
  compliant?: string | boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface IUniformCheckResponse {
  id: string;
  shiftDate: string;
  score: number;
  compliant: boolean;
  notes: string | null;
  items: ChecklistAnswer[];
  guard: IPersonSummary;
  evaluatedBy: IPersonSummary;
  client: IClientSummary | null;
  schedule: IScheduleSummary | null;
  createdAt: Date;
}
