export interface IGuardLoginLogResponse {
  id: string;
  userId: string;
  loginAt: Date;
  logoutAt: Date | null;
  user: {
    id: string;
    name: string;
    lastName: string | null;
    username: string;
  };
}
