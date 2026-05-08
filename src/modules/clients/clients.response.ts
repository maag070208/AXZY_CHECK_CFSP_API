export interface IClientResponse {
  id: string;
  name: string;
  active: boolean;
  address?: string | null;
  contactPhone?: string | null;
  createdAt: Date;
  _count?: {
    locations: number;
  };
  users?: {
    id: string;
    username: string;
  }[];
}
