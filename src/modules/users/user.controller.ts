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

export const getDataTable = async (req: Request, res: Response) => {
  try {
    const result = await userService.getDataTableUsers(req.body);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return res
        .status(401)
        .json(createTResult("", ["Usuario o contraseña incorrectos"]));
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json(createTResult("", ["Usuario o contraseña incorrectos"]));
    }

    if (!user.active) {
      return res
        .status(403)
        .json(
          createTResult("", [
            "Tu cuenta no está activa. Por favor contacta al administrador.",
          ]),
        );
    }

    if (user.client && !user.client.active) {
      return res
        .status(403)
        .json(
          createTResult("", [
            "Tu empresa no está activa en el sistema. Por favor contacta al administrador.",
          ]),
        );
    }

    // SHIFT CHECK
    const shiftCheck = checkUserShift({
      role: user.role?.name as string,
      shiftStart: user.schedule?.startTime,
      shiftEnd: user.schedule?.endTime,
    });

    if (!shiftCheck.canAccess) {
      return res
        .status(403)
        .json(createTResult("", [shiftCheck.message || "Fuera de horario"]));
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

    return res.status(200).json(createTResult(await generateJWT(tokenPayload)));
  } catch (error: any) {
    return res.status(500).json(createTResult("", error.message));
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user?.id || req.body.userId;

    if (userId) {
      await userService.updateUser(userId, { isLoggedIn: false });
    }

    return res.status(200).json(createTResult(true));
  } catch (error: any) {
    return res.status(500).json(createTResult("", error.message));
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) {
      return res
        .status(404)
        .json(createTResult(null, ["Usuario no encontrado"]));
    }
    return res.status(200).json(createTResult(user));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const users = await userService.getUsers(q as string);
    return res.status(200).json(createTResult(users));
  } catch (error: any) {
    return res.status(500).json(createTResult("", error.message));
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const data: IUserCreateRequest = req.body;

    const existing = await userService.getUserByUsername(data.username);
    if (existing) {
      return res
        .status(400)
        .json(createTResult(null, ["El nombre de usuario ya está registrado"]));
    }

    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    const user = await userService.addUser(data);
    return res.status(201).json(createTResult(user));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmPassword, ...data }: IUserUpdateRequest & { confirmPassword?: string } = req.body;

    if (data.username) {
      const existing = await userService.getUserByUsername(data.username);
      if (existing && existing.id !== id) {
        return res
          .status(400)
          .json(
            createTResult(null, ["El nombre de usuario ya está registrado"]),
          );
      }
    }

    if (data.password) {
      data.password = await hashPassword(data.password);
    } else {
      delete data.password;
    }

    const updated = await userService.updateUser(id, data);
    return res.status(200).json(createTResult(updated));
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(400)
        .json(createTResult(null, ["El nombre de usuario ya está registrado"]));
    }
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    const user = await userService.getUserById(id);
    if (!user) {
      return res
        .status(404)
        .json(createTResult(null, ["Usuario no encontrado"]));
    }

    const isValid = await comparePassword(oldPassword, user.password);
    if (!isValid) {
      return res
        .status(400)
        .json(createTResult(null, ["La contraseña actual es incorrecta"]));
    }

    const hashed = await hashPassword(newPassword);
    await userService.updateUser(id, { password: hashed });

    return res.status(200).json(createTResult(true));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const hashed = await hashPassword(newPassword);
    await userService.updateUser(id, { password: hashed });

    return res.status(200).json(createTResult(true));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await userService.deleteUser(id);
    return res.status(200).json(createTResult(true));
  } catch (error: any) {
    if (error.code === "P2003") {
      return res
        .status(400)
        .json(
          createTResult(null, [
            "No se puede eliminar este usuario porque tiene registros de historial o asignaciones.",
          ]),
        );
    }
    return res.status(500).json(createTResult(null, error.message));
  }
};
