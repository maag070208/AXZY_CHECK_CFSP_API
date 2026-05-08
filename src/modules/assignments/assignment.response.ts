import { AssignmentStatus } from "@prisma/client";

export interface IAssignmentResponse {
  id: string;
  guardId: string;
  locationId: string;
  status: AssignmentStatus;
  assignedBy: string;
  notes: string | null;
  createdAt: Date;
  location: {
    id: string;
    name: string;
    clientId: string | null;
  };
  guard: {
    id: string;
    name: string;
    lastName: string | null;
  };
  tasks: {
    id: string;
    description: string;
    reqPhoto: boolean;
    completed: boolean;
    completedAt: Date | null;
  }[];
}
