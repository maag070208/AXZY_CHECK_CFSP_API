import { z } from "zod";
import { AgendaItemType, AgendaStatus } from "@src/core/config/constants";
import {
  createShiftPlanSchema,
  updateShiftPlanSchema,
} from "./schemas/shift-plan.schema";

export type CreateShiftPlanDTO = z.infer<typeof createShiftPlanSchema>["body"];
export type UpdateShiftPlanDTO = z.infer<typeof updateShiftPlanSchema>["body"];

export interface IScheduleSummary {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface IClientSummary {
  id: string;
  name: string;
}

export interface IPersonSummary {
  id: string;
  name: string;
  lastName: string | null;
}

export interface IShiftPlanResponse {
  id: string;
  clientId: string;
  scheduleId: string;
  requireHandover: boolean;
  requireUniform: boolean;
  toleranceMinutes: number;
  daysOfWeek: number[];
  active: boolean;
  client: IClientSummary;
  schedule: IScheduleSummary;
  /** Guardias activos del cliente con este horario (deben revisar uniforme). */
  guardsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Registro que cumplió un compromiso de la agenda. */
export interface IAgendaRecord {
  id: string;
  createdAt: Date;
  by: string | null;
  score?: number;
  compliant?: boolean;
}

export interface IAgendaItem {
  /** Identificador estable: tipo:plan:fecha[:guardia]. */
  id: string;
  type: AgendaItemType;
  status: AgendaStatus;
  shiftDate: string;
  startAt: Date;
  dueAt: Date;
  endAt: Date;
  planId: string;
  client: IClientSummary;
  schedule: IScheduleSummary;
  guard: IPersonSummary | null;
  record: IAgendaRecord | null;
}

export interface IAgendaSummary {
  total: number;
  done: number;
  inWindow: number;
  overdue: number;
  missed: number;
  upcoming: number;
  /** % de compromisos ya exigibles que se cumplieron; null si aún no hay. */
  compliancePercent: number | null;
}

export interface IAgendaResponse {
  dates: string[];
  generatedAt: Date;
  items: IAgendaItem[];
  summary: IAgendaSummary;
  handoverSummary: IAgendaSummary;
  uniformSummary: IAgendaSummary;
}
