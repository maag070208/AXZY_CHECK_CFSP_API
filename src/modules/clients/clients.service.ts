import { prismaClient as prisma } from "@src/core/config/database";
import { Prisma } from "@prisma/client";
import { ROLE_CLIENT } from "@src/core/config/constants";

export const getDataTableClients = async (body: any) => {
    const { page = 1, limit = 10, filters } = body;
    const filter = filters?.search || filters?.name || "";

    const where: Prisma.ClientWhereInput = {
        softDelete: false,
        name: { contains: filter, mode: "insensitive" }
    };

    const [rows, total] = await Promise.all([
        prisma.client.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { 
                _count: { select: { locations: true } },
                users: {
                    where: { role: { name: ROLE_CLIENT } },
                    select: { id: true, username: true }
                }
            }
        }),
        prisma.client.count({ where }),
    ]);

    return { rows, total };
};

export const getClientById = async (id: string) => {
    return prisma.client.findUnique({
        where: { id },
        include: {
            users: {
                where: { role: { name: ROLE_CLIENT } },
                select: { id: true, username: true }
            }
        }
    });
};

export const getAllClients = async () => {
    return prisma.client.findMany({
        where: { active: true, softDelete: false },
        orderBy: { name: "asc" }
    });
};

import { hashPassword } from "@src/core/utils/security";

export const createClient = async (data: any) => {
    const { appUsername, appPassword, ...clientData } = data;

    return prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
            data: clientData
        });

        if (appUsername && appPassword) {
            const role = await tx.role.findUnique({ where: { name: ROLE_CLIENT } });
            if (role) {
                const hashed = await hashPassword(appPassword);
                await tx.user.create({
                    data: {
                        name: client.name,
                        lastName: 'CLIENTE',
                        username: appUsername,
                        password: hashed,
                        roleId: role.id,
                        clientId: client.id
                    }
                });
            }
        }

        return client;
    });
};

export const updateClient = async (id: string, data: any) => {
    const { appUsername, appPassword, ...clientData } = data;

    return prisma.$transaction(async (tx) => {
        const client = await tx.client.update({
            where: { id },
            data: clientData
        });

        // Cascade active status to all users of this client
        if (typeof clientData.active === 'boolean') {
            await tx.user.updateMany({
                where: { clientId: id },
                data: { active: clientData.active }
            });
        }

        if (appUsername || appPassword) {
            const role = await tx.role.findUnique({ where: { name: ROLE_CLIENT } });
            if (role) {
                const user = await tx.user.findFirst({
                    where: { clientId: id, roleId: role.id }
                });

                if (user) {
                    const updateData: any = { username: appUsername || user.username };
                    if (appPassword) updateData.password = await hashPassword(appPassword);

                    await tx.user.update({
                        where: { id: user.id },
                        data: updateData
                    });
                } else if (appUsername && appPassword) {
                    const hashed = await hashPassword(appPassword);
                    await tx.user.create({
                        data: {
                            name: client.name,
                            lastName: 'CLIENTE',
                            username: appUsername,
                            password: hashed,
                            roleId: role.id,
                            clientId: client.id
                        }
                    });
                }
            }
        }

        return client;
    });
};

export const deleteClient = async (id: string) => {
    return prisma.$transaction(async (tx) => {
        // Deactivate all users of this client
        await tx.user.updateMany({
            where: { clientId: id },
            data: { active: false }
        });

        return tx.client.update({
            where: { id },
            data: { softDelete: true, active: false }
        });
    });
};
