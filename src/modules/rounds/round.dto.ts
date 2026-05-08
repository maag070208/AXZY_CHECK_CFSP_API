import { TResult } from "@src/core/dto/TResult";
import { TIMELINE_EVENT_START, TIMELINE_EVENT_END, TIMELINE_EVENT_SCAN, TIMELINE_EVENT_INCIDENT } from "@src/core/config/constants";

export interface IRoundStartRequest {
  guardId: string;
  clientId?: string;
  recurringConfigurationId?: string;
}

export interface IRoundDetail {
  round: any;
  timeline: Array<{
    type: typeof TIMELINE_EVENT_START | typeof TIMELINE_EVENT_END | typeof TIMELINE_EVENT_SCAN | typeof TIMELINE_EVENT_INCIDENT;
    timestamp: Date;
    description: string;
    data: any;
  }>;
}

export type TRoundDetailResult = TResult<IRoundDetail | null>;
