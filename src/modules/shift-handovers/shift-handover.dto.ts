import { z } from "zod";
import { ChecklistAnswer } from "@src/core/utils/checklist.utils";
import { IClientSummary, IPersonSummary, IScheduleSummary } from "../shift-plans/shift-plan.dto";
import { createShiftHandoverSchema } from "./schemas/shift-handover.schema";

export type CreateShiftHandoverDTO = z.infer<typeof createShiftHandoverSchema>["body"];

/** Filtros aceptados por `POST /shift-handovers/datatable`. */
export interface IShiftHandoverFilters {
  clientId?: string;
  scheduleId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface IShiftHandoverElementResponse {
  id: string;
  entryTime: string;
  punctual: boolean;
  observations: string | null;
  guard: IPersonSummary;
}

export interface IShiftHandoverListItem {
  id: string;
  shiftDate: string;
  credentialsCount: number | null;
  tarjetonesCount: number | null;
  reportedToAdmin: boolean;
  checklistOk: number;
  checklistTotal: number;
  elementsCount: number;
  lateCount: number;
  client: IClientSummary;
  schedule: IScheduleSummary;
  createdBy: IPersonSummary;
  createdAt: Date;
}

export interface IShiftHandoverDetail extends IShiftHandoverListItem {
  novedades: string | null;
  checklist: ChecklistAnswer[];
  elements: IShiftHandoverElementResponse[];
}
