import { RoundStatus } from "@prisma/client";

export interface IRoundResponse {
  id: string;
  guardId: string;
  clientId: string | null;
  startTime: Date;
  endTime: Date | null;
  status: RoundStatus;
  recurringConfigurationId: string | null;
  guard: {
    id: string;
    name: string;
    lastName: string | null;
    username: string;
    client?: { name: string } | null;
  };
  client?: {
    id: string;
    name: string;
  } | null;
  recurringConfiguration?: {
    id: string;
    title: string;
    client?: { name: string } | null;
  } | null;
}
