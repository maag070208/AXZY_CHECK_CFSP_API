import { Prisma } from "@prisma/client";
import { ITDataTableFetchParams } from "@src/core/dto/datatable.dto";
import { prismaClient as prisma } from "@src/core/config/database";
import { createAuditLog } from "../audit/audit.service";

export const getZonesDataTable = async (body: ITDataTableFetchParams) => {
    const { filters } = body;
    const clientId = filters?.clientId;
    const search = filters?.search;

    const where: Prisma.ZoneWhereInput = {
        softDelete: false,
        active: true
    };

    if (clientId) {
        where.clientId = clientId as string;
    }

    if (search) {
        where.name = { contains: search as string, mode: 'insensitive' };
    }

    const rows = await prisma.zone.findMany({
        where,
        include: {
          client: true,
          _count: {
            select: { locations: { where: { softDelete: false } } }
          }
        },
        orderBy: { id: "desc" }
    });

    return { rows, total: rows.length };
};

export const getZonesByClient = async (clientId: string) => {
    return prisma.zone.findMany({
        where: { clientId, softDelete: false, active: true },
        orderBy: { id: "desc" }
    });
};

export const createZone = async (data: { clientId: string; name: string }, userId: string) => {
    const zone = await prisma.zone.create({
        data
    });

    await createAuditLog({
        userId,
        module: "ZONES",
        action: "CREATE",
        resourceId: zone.id,
        details: { name: zone.name, clientId: zone.clientId },
    });

    return zone;
};

export const updateZone = async (id: string, data: { name?: string; active?: boolean }, userId: string) => {
    const zone = await prisma.zone.update({
        where: { id },
        data
    });

    await createAuditLog({
        userId,
        module: "ZONES",
        action: "UPDATE",
        resourceId: id,
        details: data,
    });

    return zone;
};

export const deleteZone = async (id: string, userId: string) => {
    const zone = await prisma.zone.update({
        where: { id },
        data: { softDelete: true, active: false }
    });

    await createAuditLog({
        userId,
        module: "ZONES",
        action: "DELETE",
        resourceId: id,
    });

    return zone;
};
