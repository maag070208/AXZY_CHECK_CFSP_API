import { prismaClient } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";

export const getUsers = async (search?: string) => {
  if (!search) {
    return prismaClient.user.findMany({
        where: { softDelete: false },
        orderBy: { name: 'asc' },
        include: { schedule: true, role: true, assignments: true }
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
    include: { schedule: true, role: true, assignments: true }
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
      include: { schedule: true, role: true, assignments: true }
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
      role: true
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
        roleId: Number(targetRoleId)
    },
  });
};

export const updateUser = async (id: number, data: any) => {
  const { role: roleName, ...userData } = data;
  
  if (!userData.roleId && roleName) {
      const roleObj = await prismaClient.role.findUnique({ where: { name: roleName } });
      if (roleObj) userData.roleId = roleObj.id;
  }

  return prismaClient.user.update({
    where: {
      id,
    },
    data: userData,
  });
};

export const getUserById = async (id: number) => {
  return prismaClient.user.findUnique({
    where: {
      id,
    },
  });
};


export const getLoggedInGuards = async (excludeUserId: number) => {
  return prismaClient.user.findMany({
    where: {
      role: {
        name: {
          in: ['GUARD', 'SHIFT', 'MAINT'],
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

export const deleteUser = async (id: number) => {
  return prismaClient.user.delete({
    where: { id }
  });
};
