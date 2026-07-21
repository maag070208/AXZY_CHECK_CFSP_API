import { prismaClient as prisma } from "@src/core/config/database";
import { createAuditLog } from "../audit/audit.service";

export const getRecurringDataTable = async (body: any) => {
    const { page = 1, limit = 10, filters } = body;
    const { title, search, clientId } = filters || {};
    const filterText = search || title || "";

    const where: any = {
        softDelete: false,
        title: { contains: filterText, mode: "insensitive" }
    };

    if (clientId) {
        where.OR = [
            { clientId: clientId },
            { recurringLocations: { some: { location: { clientId: clientId } } } }
        ];
    }

    const [rows, total] = await Promise.all([
        prisma.recurringConfiguration.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                client: true,
                recurringLocations: {
                    include: {
                        location: {
                            include: { client: true }
                        },
                        tasks: true
                    }
                },
                guards: true
            }
        }),
        prisma.recurringConfiguration.count({ where }),
    ]);

    return { rows, total };
};

export const createRecurring = async (data: any, userId: string) => {
    const { title, locations, guardIds, clientId, active = true } = data;

    const config = await prisma.$transaction(async (tx) => {
        const newConfig = await tx.recurringConfiguration.create({
            data: {
                title,
                clientId: clientId as string,
                active,
                guards: {
                    connect: (guardIds || []).map((id: string) => ({ id }))
                }
            }
        });

        const createdLocs = await (tx.recurringLocation as any).createManyAndReturn({
            data: locations.map((loc: any) => ({
                recurringConfigurationId: newConfig.id,
                locationId: loc.locationId as string,
            }))
        });

        const tasksData: any[] = [];
        locations.forEach((loc: any) => {
            if (loc.tasks && loc.tasks.length > 0) {
                const rLoc = createdLocs.find((rl: any) => rl.locationId === (loc.locationId as string));
                if (rLoc) {
                    loc.tasks.forEach((t: any) => {
                        tasksData.push({
                            recurringLocationId: rLoc.id,
                            description: t.description,
                            reqPhoto: t.reqPhoto
                        });
                    });
                }
            }
        });

        if (tasksData.length > 0) {
            await tx.recurringTask.createMany({ data: tasksData });
        }

        return newConfig;
    }, {
        maxWait: 10000,
        timeout: 30000
    });

    await createAuditLog({
        userId,
        module: "RECURRING",
        action: "CREATE",
        resourceId: config.id,
        details: { title, clientId, active }
    });

    return config;
};

export const updateRecurring = async (id: string, data: any, userId: string) => {
    const { title, locations, guardIds, clientId, active } = data;

    const config = await prisma.$transaction(async (tx) => {
        const oldLocations = await tx.recurringLocation.findMany({
            where: { recurringConfigurationId: id },
            select: { id: true }
        });
        const oldLocIds = oldLocations.map(l => l.id);

        await tx.recurringTask.deleteMany({ where: { recurringLocationId: { in: oldLocIds } } });
        await tx.recurringLocation.deleteMany({ where: { recurringConfigurationId: id } });

        const updatedConfig = await tx.recurringConfiguration.update({
            where: { id },
            data: {
                title,
                clientId: clientId as string,
                active,
                guards: {
                    set: (guardIds || []).map((id: string) => ({ id }))
                }
            }
        });

        const createdLocs = await (tx.recurringLocation as any).createManyAndReturn({
            data: locations.map((loc: any) => ({
                recurringConfigurationId: updatedConfig.id,
                locationId: loc.locationId as string,
            }))
        });

        const tasksData: any[] = [];
        locations.forEach((loc: any) => {
            if (loc.tasks && loc.tasks.length > 0) {
                const rLoc = createdLocs.find((rl: any) => rl.locationId === (loc.locationId as string));
                if (rLoc) {
                    loc.tasks.forEach((t: any) => {
                        tasksData.push({
                            recurringLocationId: rLoc.id,
                            description: t.description,
                            reqPhoto: t.reqPhoto
                        });
                    });
                }
            }
        });

        if (tasksData.length > 0) {
            await tx.recurringTask.createMany({ data: tasksData });
        }

        return updatedConfig;
    }, {
        maxWait: 10000,
        timeout: 30000
    });

    await createAuditLog({
        userId,
        module: "RECURRING",
        action: "UPDATE",
        resourceId: id,
        details: { title, clientId, active }
    });

    return config;
};

export const deleteRecurring = async (id: string, userId: string) => {
    const config = await prisma.recurringConfiguration.update({
        where: { id },
        data: { softDelete: true, active: false }
    });

    await createAuditLog({
        userId,
        module: "RECURRING",
        action: "DELETE",
        resourceId: id
    });

    return config;
};

export const getRecurringById = async (id: string) => {
    return prisma.recurringConfiguration.findUnique({
        where: { id },
        include: {
            recurringLocations: {
                include: {
                    location: {
                        include: { client: true }
                    },
                    tasks: true
                }
            },
            guards: true
        }
    });
};

export const getRecurringByGuard = async (guardId: string) => {
    const guard = await prisma.user.findUnique({
        where: { id: guardId },
        select: { clientId: true },
    });

    if (!guard?.clientId) return [];

    return prisma.recurringConfiguration.findMany({
        where: {
            softDelete: false,
            active: true,
            clientId: guard.clientId,
            guards: {
                some: { id: guardId }
            }
        },
        include: {
            recurringLocations: {
                include: {
                    location: {
                        include: { client: true }
                    },
                    tasks: true
                }
            },
            guards: true
        }
    });
};

export const getAllRecurring = async () => {
    return prisma.recurringConfiguration.findMany({
        where: {
            softDelete: false,
        },
        include: {
            recurringLocations: {
                include: {
                    location: {
                        include: { client: true }
                    },
                    tasks: true
                }
            },
            guards: true
        }
    });
};

