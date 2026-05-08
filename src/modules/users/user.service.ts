import { prismaClient } from "@src/core/config/database";
import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { OPERATIONAL_ROLES, ROLE_CLIENT } from "@src/core/config/constants";
import { IUserCreateRequest, IUserUpdateRequest } from "./user.dto";
import { deleteClientDataCascade } from "../clients/clients.cascade";

import { IUserResponse } from "./user.response";

export const getUsers = async (search?: string): Promise<IUserResponse[]> => {
  const where = {
    role: { name: { not: ROLE_CLIENT } },
    ...(search && {
      OR: [
        { name: { contains: search } },
        { lastName: { contains: search } },
        { username: { contains: search } },
      ],
    }),
  };

  const users = await prismaClient.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      lastName: true,
      username: true,
      active: true,
      isLoggedIn: true,
      roleId: true,
      clientId: true,
      scheduleId: true,
      role: { select: { id: true, name: true, value: true } },
      client: { select: { id: true, name: true } },
      schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
      assignmentLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return users as IUserResponse[];
};

export const getDataTableUsers = async (
  params: ITDataTableFetchParams,
): Promise<ITDataTableResponse<IUserResponse>> => {
  const prismaParams = getPrismaPaginationParams(params);

  // If there's a name filter, convert it to a global OR search (name, lastName, username)
  if (prismaParams.where.name && typeof prismaParams.where.name === 'object' && prismaParams.where.name.contains) {
    const searchVal = prismaParams.where.name.contains;
    const mode = prismaParams.where.name.mode;
    delete prismaParams.where.name;
    
    prismaParams.where = {
      ...prismaParams.where,
      OR: [
        { name: { contains: searchVal, mode } },
        { lastName: { contains: searchVal, mode } },
        { username: { contains: searchVal, mode } },
      ],
    };
  }

  // Fix: role is a relation, map string to relation filter
  if (prismaParams.where.role && typeof prismaParams.where.role === 'object' && prismaParams.where.role.contains) {
      const roleName = prismaParams.where.role.contains;
      delete prismaParams.where.role;
      prismaParams.where.role = { name: roleName };
  } else if (typeof prismaParams.where.role === 'string') {
      const roleName = prismaParams.where.role;
      delete prismaParams.where.role;
      prismaParams.where.role = { name: roleName };
  }

  // Enforce excluding client role
  prismaParams.where = {
    ...prismaParams.where,
    role: { ...prismaParams.where.role, name: { ...prismaParams.where.role?.name, not: ROLE_CLIENT } }
  };

  const [rows, total] = await Promise.all([
    prismaClient.user.findMany({
      ...prismaParams,
      where: prismaParams.where,
      select: {
        id: true,
        name: true,
        lastName: true,
        username: true,
        active: true,
        isLoggedIn: true,
        roleId: true,
        clientId: true,
        scheduleId: true,
        role: { select: { id: true, name: true, value: true } },
        client: { select: { id: true, name: true } },
        schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
        assignments: {
          where: { status: { not: 'REVIEWED' } },
          select: { id: true }
        },
        assignmentLogs: {
            orderBy: { createdAt: "desc" },
            take: 1,
        },
      },
    }),
    prismaClient.user.count({
      where: prismaParams.where,
    }),
  ]);

  return { rows, total };
};

export const getUserByUsername = async (username: string) => {
  return prismaClient.user.findFirst({
    where: {
      username,
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      username: true,
      password: true,
      active: true,
      roleId: true,
      clientId: true,
      scheduleId: true,
      role: { select: { id: true, name: true, value: true } },
      client: { select: { id: true, active: true, name: true } },
      schedule: { select: { id: true, startTime: true, endTime: true, name: true } },
      assignmentLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
};

export const addUser = async (data: IUserCreateRequest) => {
  const { role: roleName, ...userData } = data;

  let targetRoleId = userData.roleId;

  if (!targetRoleId && roleName) {
    const roleObj = await prismaClient.role.findUnique({
      where: { name: roleName },
    });
    if (roleObj) targetRoleId = roleObj.id;
  }

  if (targetRoleId) {
    const targetRole = await prismaClient.role.findUnique({ where: { id: targetRoleId } });
    if (targetRole?.name === ROLE_CLIENT) {
        throw new Error("No puedes crear usuarios de tipo CLIENTE desde este módulo.");
    }
  }

  return prismaClient.user.create({
    data: {
      ...userData,
      password: userData.password || "", // Prisma needs string
      roleId: targetRoleId!,
    } as any,
    include: { schedule: true, role: true, client: true },
  });
};

export const updateUser = async (id: string, data: IUserUpdateRequest) => {
  const { role: roleName, ...userData } = data;

  if (!userData.roleId && roleName) {
    const roleObj = await prismaClient.role.findUnique({
      where: { name: roleName },
    });
    if (roleObj) userData.roleId = roleObj.id;
  }

  // Remove undefined/null for fields that Prisma doesn't like as null
  if (userData.roleId === null) delete userData.roleId;

  return prismaClient.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({ where: { id } });
    
    // Auto logging on clientId change
    if (userData.clientId !== undefined && userData.clientId !== currentUser?.clientId) {
        await tx.assignmentLog.create({
            data: {
                guardId: id,
                clientId: (userData.clientId as string) || null,
                type: userData.clientId ? "ASIGNADO" : "REMOVIDO",
                notes: userData.clientId ? `Asignado a cliente` : "Removido de cliente",
            }
        });
    }

    const updatedUser = await tx.user.update({
      where: { id },
      data: userData as any,
      include: { schedule: true, role: true, client: true },
    });

    if (updatedUser.role?.name === ROLE_CLIENT) {
        throw new Error("No puedes asignar el rol CLIENTE desde este módulo.");
    }

    return updatedUser;
  });
};

export const getUserById = async (id: string) => {
  return prismaClient.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      username: true,
      password: true,
      active: true,
      clientId: true,
      roleId: true,
      scheduleId: true,
      role: { select: { id: true, name: true, value: true } },
      schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
      client: { select: { id: true, name: true, active: true } },
    },
  });
};

export const getLoggedInGuards = async (excludeUserId: string) => {
  return prismaClient.user.findMany({
    where: {
      role: {
        name: {
          in: OPERATIONAL_ROLES,
        },
      },
      isLoggedIn: true,
      id: {
        not: excludeUserId,
      },
    },
    include: { role: true },
  });
};

export const deleteUser = async (id: string) => {
  return prismaClient.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (user?.clientId && user.role?.name === ROLE_CLIENT) {
      await deleteClientDataCascade(tx, user.clientId, id);
    }

    return tx.user.delete({
      where: { id },
    });
  });
};

