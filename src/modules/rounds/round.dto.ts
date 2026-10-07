import { Prisma } from "@prisma/client";
import { TResult } from "@src/core/dto/TResult";
import { TIMELINE_EVENT_START, TIMELINE_EVENT_END, TIMELINE_EVENT_SCAN, TIMELINE_EVENT_INCIDENT } from "@src/core/config/constants";

export interface IRoundStartRequest {
  guardId: string;
  clientId?: string;
  recurringConfigurationId?: string;
}

/** Datos de un evento SCAN: el registro de kardex con su punto. */
export type TRoundTimelineData = Prisma.KardexGetPayload<{
  include: { location: true; assignment: { include: { tasks: true } } };
}>;

/** Evento de la línea de tiempo de una ronda. */
export interface IRoundTimelineEvent {
  type:
    | typeof TIMELINE_EVENT_START
    | typeof TIMELINE_EVENT_END
    | typeof TIMELINE_EVENT_SCAN
    | typeof TIMELINE_EVENT_INCIDENT;
  timestamp: Date;
  description: string;
  data: TRoundTimelineData | null;
}

/** Ronda con las relaciones que devuelve `getRoundDetail`. */
export type TRoundDetailRound = Prisma.RoundGetPayload<{
  include: {
    guard: { include: { client: true } };
    client: { include: { locations: true } };
    recurringConfiguration: {
      include: {
        recurringLocations: { include: { location: true } };
        client: true;
      };
    };
  };
}>;

export interface IRoundDetail {
  round: TRoundDetailRound;
  timeline: IRoundTimelineEvent[];
}

export type TRoundDetailResult = TResult<IRoundDetail | null>;
