export interface IClientResponse {
  id: string;
  name: string;
  active: boolean;
  address?: string | null;
  contactPhone?: string | null;
  rfc?: string | null;
  contactName?: string | null;
  softDelete?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  _count?: {
    locations: number;
  };
  users?: {
    id: string;
    username: string;
  }[];
}

