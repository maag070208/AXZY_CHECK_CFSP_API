import { prismaClient as prisma } from "@src/core/config/database";
import { Prisma } from "@prisma/client";
import { ROLE_CLIENT } from "@src/core/config/constants";
import { IClientCreateRequest, IClientUpdateRequest } from "./clients.dto";
import { hashPassword } from "@src/core/utils/security";
import { deleteClientDataCascade } from "./clients.cascade";

import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { IClientResponse } from "./clients.response";

export const getDataTableClients = async (
  params: ITDataTableFetchParams,
): Promise<ITDataTableResponse<IClientResponse>> => {
  const { page = 1, limit = 10, filters } = params;
  const filter = (filters as any)?.search || (filters as any)?.name || "";
  const isActive = (filters as any)?.active;

  const where: Prisma.ClientWhereInput = {
    softDelete: false,
    name: { contains: filter, mode: "insensitive" },
  };

  if (isActive !== undefined) {
    where.active = isActive === "true" || isActive === true;
  }

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        active: true,
        address: true,
        contactPhone: true,
        rfc: true,
        contactName: true,
        softDelete: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        _count: { select: { locations: true } },
        users: {
          where: { role: { name: ROLE_CLIENT } },
          select: { id: true, username: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return { rows: rows as IClientResponse[], total };
};

export const getClientById = async (
  id: string,
): Promise<IClientResponse | null> => {
  return prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      address: true,
      contactPhone: true,
      rfc: true,
      contactName: true,
      softDelete: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      users: {
        where: { role: { name: ROLE_CLIENT } },
        select: { id: true, username: true },
      },
    },
  }) as Promise<IClientResponse | null>;
};

export const getAllClients = async (): Promise<IClientResponse[]> => {
  return prisma.client.findMany({
    where: { active: true, softDelete: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      active: true,
      createdAt: true,
    },
  }) as Promise<IClientResponse[]>;
};

export const createClient = async (data: IClientCreateRequest) => {
  const { appUsername, appPassword, ...clientData } = data;

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: clientData as any, // Cast because of some Prisma strictness with nested types if any
    });

    if (appUsername && appPassword) {
      const role = await tx.role.findUnique({ where: { name: ROLE_CLIENT } });
      if (role) {
        const existingUsername = await tx.user.findUnique({
          where: { username: appUsername },
        });
        if (existingUsername) {
          throw new Error(
            `El nombre de usuario "${appUsername}" ya está en uso.`,
          );
        }

        const hashed = await hashPassword(appPassword);
        await tx.user.create({
          data: {
            name: client.name,
            lastName: "CLIENTE",
            username: appUsername,
            password: hashed,
            roleId: role.id,
            clientId: client.id,
          },
        });
      }
    }

    return client;
  });
};

export const updateClient = async (id: string, data: IClientUpdateRequest) => {
  const { appUsername, appPassword, ...clientData } = data;

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id },
      data: clientData as any,
    });

    if (appUsername || appPassword) {
      const role = await tx.role.findUnique({ where: { name: ROLE_CLIENT } });
      if (role) {
        const clientUser = await tx.user.findFirst({
          where: { clientId: id, roleId: role.id },
        });

        // Solo validamos si intentan cambiar el username por uno nuevo
        if (appUsername && appUsername !== clientUser?.username) {
          const isTaken = await tx.user.findUnique({
            where: { username: appUsername },
          });
          if (isTaken) {
            throw new Error(
              `El nombre de usuario "${appUsername}" ya está en uso por otro usuario.`,
            );
          }
        }

        if (clientUser) {
          const updateData: any = {};
          if (appUsername && appUsername !== clientUser.username)
            updateData.username = appUsername;
          if (appPassword)
            updateData.password = await hashPassword(appPassword);

          if (Object.keys(updateData).length > 0) {
            await tx.user.update({
              where: { id: clientUser.id },
              data: updateData,
            });
          }
        } else if (appUsername && appPassword) {
          const hashed = await hashPassword(appPassword);
          await tx.user.create({
            data: {
              name: client.name,
              lastName: "CLIENTE",
              username: appUsername,
              password: hashed,
              roleId: role.id,
              clientId: client.id,
            },
          });
        }
      }
    }

    return client;
  });
};

export const deleteClient = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    await deleteClientDataCascade(tx, id);

    return tx.client.delete({
      where: { id },
    });
  });
};
