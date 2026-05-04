import { prismaClient } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { OPERATIONAL_ROLES } from "@src/core/config/constants";

export const getUsers = async (search?: string) => {
  if (!search) {
    return prismaClient.user.findMany({
        where: { softDelete: false },
        orderBy: { name: 'asc' },
        include: { schedule: true, role: true, assignments: true, client: true }
    });
  }

  return prismaClient.user.findMany({
    where: {
      softDelete: false,
      OR: [
          { name: { contains: search } }, 
          { lastName: { contains: search } },
          { username: { contains: search } }
      ]
    },
    orderBy: { name: 'asc' },
    include: { schedule: true, role: true, assignments: true, client: true }
  });
};

export const getDataTableUsers = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
  const prismaParams = getPrismaPaginationParams(params);

  const [rows, total] = await Promise.all([
    prismaClient.user.findMany({
      ...prismaParams,
      where: {
        ...prismaParams.where,
        softDelete: false, // Maintain business logic
      },
      include: { schedule: true, role: true, assignments: true, client: true }
    }),
    prismaClient.user.count({ 
      where: {
        ...prismaParams.where,
        softDelete: false,
      }
    })
  ]);

  return { rows, total };
};

export const getUserByUsername = async (username: string) => {
  return prismaClient.user.findFirst({
    where: {
      username,
    },
    include: {
      schedule: true,
      role: true,
      client: true
    }
  });
};

export const addUser = async (data: any) => {
  const { role: roleName, ...userData } = data;
  
  let targetRoleId = userData.roleId;
  
  if (!targetRoleId && roleName) {
      const roleObj = await prismaClient.role.findUnique({ where: { name: roleName } });
      if (roleObj) targetRoleId = roleObj.id;
  }

  // Auto-Assign Recurring Configs if Guard/Staff - Logic removed since Rutas no longer exist

  return prismaClient.user.create({
    data: {
        ...userData,
        roleId: targetRoleId
    },
    include: { schedule: true, role: true, client: true }
  });
};

export const updateUser = async (id: string, data: any) => {
  const { role: roleName, ...userData } = data;
  
  if (!userData.roleId && roleName) {
      const roleObj = await prismaClient.role.findUnique({ where: { name: roleName } });
      if (roleObj) userData.roleId = roleObj.id;
  }

  return prismaClient.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: userData,
      include: { schedule: true, role: true, client: true }
    });

    // Cascade active to the associated client if this user is a client user
    if (typeof userData.active === 'boolean' && updatedUser.clientId) {
      await tx.client.update({
        where: { id: updatedUser.clientId },
        data: { active: userData.active }
      });
    }

    return updatedUser;
  });
};

export const getUserById = async (id: string) => {
  return prismaClient.user.findUnique({
    where: {
      id,
    },
  });
};


export const getLoggedInGuards = async (excludeUserId: string) => {
  return prismaClient.user.findMany({
    where: {
      role: {
        name: {
          in: OPERATIONAL_ROLES,
        }
      },
      isLoggedIn: true,
      id: {
        not: excludeUserId,
      },
    },
    include: { role: true }
  });
};

export const deleteUser = async (id: string) => {
  return prismaClient.user.delete({
    where: { id }
  });
};
