import { IncidentStatus } from "@prisma/client";

export interface IIncidentResponse {
  id: string;
  guardId: string;
  title: string;
  categoryId: string | null;
  typeId: string | null;
  description: string | null;
  media: any;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedById: string | null;
  status: IncidentStatus;
  clientId: string | null;
  guard?: {
    id: string;
    name: string;
    lastName: string | null;
    username: string;
  };
  resolvedBy?: {
    id: string;
    name: string;
    lastName: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
  type?: {
    id: string;
    name: string;
  } | null;
  client?: {
    id: string;
    name: string;
  } | null;
}
