import { ScanType, Prisma } from "@prisma/client";

export interface IKardexResponse {
  id: string;
  userId: string;
  locationId: string;
  timestamp: Date;
  notes: string | null;
  media: Prisma.JsonValue;
  latitude: number | null;
  longitude: number | null;
  assignmentId: string | null;
  scanType: ScanType;
  user: {
    id: string;
    name: string;
    lastName: string | null;
    username: string;
    role?: { name: string };
  };
  location: {
    id: string;
    name: string;
    clientId: string | null;
  };
  assignment?: {
    id: string;
    status: string;
    tasks?: Array<{ id: string; description: string; completed: boolean; reqPhoto: boolean }>;
  } | null;
}
