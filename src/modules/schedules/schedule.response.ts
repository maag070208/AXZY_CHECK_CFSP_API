export interface IScheduleResponse {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
  createdAt: Date;
  _count?: {
    users: number;
  };
}
