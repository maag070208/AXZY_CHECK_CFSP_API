export interface IUserLoginRequest {
  username: string;
  password: string;
}

export interface IUserCreateRequest {
  name: string;
  lastName?: string;
  username: string;
  password?: string;
  roleId?: string | null;
  role?: string;
  shiftStart?: string;
  shiftEnd?: string;
  scheduleId?: string | null;
  clientId?: string | null;
}

export interface IUserUpdateRequest extends Partial<IUserCreateRequest> {
  active?: boolean;
  isLoggedIn?: boolean;
}
