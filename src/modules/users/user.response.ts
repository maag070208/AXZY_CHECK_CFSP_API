export interface IUserResponse {
  id: string;
  name: string;
  lastName: string | null;
  username: string;
  active: boolean;
  isLoggedIn: boolean;
  roleId: string;
  clientId: string | null;
  scheduleId: string | null;
  role: {
    id: string;
    name: string;
    value: string;
  };
  client?: {
    id: string;
    name: string;
  } | null;
  schedule?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  assignmentLogs?: any[];
}
