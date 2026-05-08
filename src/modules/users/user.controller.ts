import { createTResult } from "@src/core/mappers/tresult.mapper";
import {
  comparePassword,
  generateJWT,
  hashPassword,
} from "@src/core/utils/security";
import { checkUserShift } from "@src/core/utils/shift.utils";
import { Request, Response } from "express";
import { IUserCreateRequest, IUserUpdateRequest } from "./user.dto";
import * as userService from "./user.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { createAuditLog } from "../audit/audit.service";


export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getDataTableUsers(req.body);
  return res.status(200).json(createTResult(result));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await userService.getUserByUsername(username);

  if (!user) {
    throw new AppError("Usuario o contraseña incorrectos", 401);
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Usuario o contraseña incorrectos", 401);
  }

  if (!user.active) {
    throw new AppError("Tu cuenta no está activa. Por favor contacta al administrador.", 403);
  }

  if (user.client && !user.client.active) {
    throw new AppError("Tu empresa no está activa en el sistema. Por favor contacta al administrador.", 403);
  }

  // SHIFT CHECK
  const shiftCheck = checkUserShift({
    role: user.role?.name as string,
    shiftStart: user.schedule?.startTime,
    shiftEnd: user.schedule?.endTime,
  });

  if (!shiftCheck.canAccess) {
    throw new AppError(shiftCheck.message || "Fuera de horario", 403);
  }

  // Update logged in status
  await userService.updateUser(user.id, { isLoggedIn: true });

  const tokenPayload = {
    id: user.id,
    name: user.name,
    lastName: user.lastName,
    username: user.username,
    role: user.role?.name,
    clientId: user.clientId,
    shiftStart: user.schedule?.startTime,
    shiftEnd: user.schedule?.endTime,
  };

  await createAuditLog({
    userId: user.id,
    module: "AUTH",
    action: "LOGIN",
    details: { username: user.username }
  });

  return res.status(200).json(createTResult(await generateJWT(tokenPayload)));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user?.id || req.body.userId;

  if (userId) {
    await userService.updateUser(userId, { isLoggedIn: false });
    await createAuditLog({
      userId,
      module: "AUTH",
      action: "LOGOUT"
    });
  }

  return res.status(200).json(createTResult(true));
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await userService.getUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return res.status(200).json(createTResult(user));
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;
  const users = await userService.getUsers(q as string);
  return res.status(200).json(createTResult(users));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data: IUserCreateRequest = req.body;

  const existing = await userService.getUserByUsername(data.username);
  if (existing) {
    throw new AppError("El nombre de usuario ya está registrado", 400);
  }

  if (data.password) {
    data.password = await hashPassword(data.password);
  }

  const user = await userService.addUser(data);

  await createAuditLog({
    userId: res.locals.user?.id || user.id,
    module: "USERS",
    action: "CREATE",
    resourceId: user.id,
    details: { username: user.username, role: user.role?.name }
  });

  return res.status(201).json(createTResult(user));
});

export const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { confirmPassword, ...data }: IUserUpdateRequest & { confirmPassword?: string } = req.body;

  if (data.username) {
    const existing = await userService.getUserByUsername(data.username);
    if (existing && existing.id !== id) {
      throw new AppError("El nombre de usuario ya está registrado", 400);
    }
  }

  if (data.password) {
    data.password = await hashPassword(data.password);
  } else {
    delete data.password;
  }

  const updated = await userService.updateUser(id, data);

  await createAuditLog({
    userId: res.locals.user?.id || id,
    module: "USERS",
    action: "UPDATE",
    resourceId: id,
    details: data
  });

  return res.status(200).json(createTResult(updated));
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { oldPassword, newPassword } = req.body;

  const user = await userService.getUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const isValid = await comparePassword(oldPassword, user.password);
  if (!isValid) {
    throw new AppError("La contraseña actual es incorrecta", 400);
  }

  const hashed = await hashPassword(newPassword);
  await userService.updateUser(id, { password: hashed });

  return res.status(200).json(createTResult(true));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const hashed = await hashPassword(newPassword);
  await userService.updateUser(id, { password: hashed });

  return res.status(200).json(createTResult(true));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await userService.deleteUser(id);

  await createAuditLog({
    userId: res.locals.user?.id || "SYSTEM",
    module: "USERS",
    action: "DELETE",
    resourceId: id
  });

  return res.status(200).json(createTResult(true));
});
