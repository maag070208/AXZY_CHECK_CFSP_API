import { prismaClient } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { MAINTENANCE_STATUS_ATTENDED, MAINTENANCE_STATUS_PENDING } from "@src/core/config/constants";

export const getDataTableMaintenances = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
    const prismaParams = getPrismaPaginationParams(params);
    
    if (params.filters.clientId && params.filters.clientId !== 'ALL') {
        prismaParams.where.clientId = params.filters.clientId;
    }

    const [rows, total] = await Promise.all([
        prismaClient.maintenance.findMany({
            ...prismaParams,
            include: { 
                guard: true,
                resolvedBy: true,
                client: true,
                categoryRel: true,
                type: true
            },
        }),
        prismaClient.maintenance.count({
            where: prismaParams.where
        })
    ]);

    return { rows, total };
};

import { sendMaintenanceEmail, sendMaintenanceWhatsApp } from "@src/core/utils/emailSender";

export const createMaintenance = async (data: {
    guardId: string;
    title: string;
    categoryId?: string;
    typeId?: string;
    category?: string;
    description?: string;
    media?: any;
    latitude?: number;
    longitude?: number;
    clientId?: string;
}) => {
    let clientId = data.clientId;
    if (!clientId) {
        const guard = await prismaClient.user.findUnique({ where: { id: data.guardId } });
        clientId = guard?.clientId || undefined;
    }

    const maintenance = await prismaClient.maintenance.create({
        data: {
            guardId: data.guardId,
            title: data.title,
            categoryId: data.categoryId,
            typeId: data.typeId,
            category: data.category,
            description: data.description,
            media: data.media,
            latitude: data.latitude,
            longitude: data.longitude,
            clientId: clientId
        }
    });

    setImmediate(async () => {
        try {
            const enrichedMaintenance = await prismaClient.maintenance.findUnique({
                where: { id: maintenance.id },
                include: { 
                    guard: true,
                    categoryRel: true,
                    type: true
                }
            });
            if (enrichedMaintenance) {
                await sendMaintenanceEmail(enrichedMaintenance, enrichedMaintenance.guard);
                await sendMaintenanceWhatsApp(enrichedMaintenance, enrichedMaintenance.guard);
            }
        } catch (error) {
            console.error("Background maintenance processing error:", error);
        }
    });

    return maintenance;
};

export const getMaintenancesByGuard = async (guardId: string) => {
    return prismaClient.maintenance.findMany({
        where: { guardId },
        orderBy: { createdAt: 'desc' }
    });
};

export const getMaintenances = async (filters: {
    startDate?: Date;
    endDate?: Date;
    guardId?: string;
    category?: string;
    title?: string;
    clientId?: string;
}) => {
    const whereClause: any = {};

    if (filters.startDate && filters.endDate) {
        whereClause.createdAt = {
            gte: filters.startDate,
            lte: filters.endDate
        };
    } else if (filters.startDate) {
        whereClause.createdAt = { gte: filters.startDate };
    }

    if (filters.guardId) whereClause.guardId = filters.guardId;
    if (filters.category) whereClause.category = filters.category;
    if (filters.title) whereClause.title = { contains: filters.title, mode: 'insensitive' };
    if (filters.clientId) whereClause.clientId = filters.clientId;

    return prismaClient.maintenance.findMany({
        where: whereClause,
        include: { 
            guard: true,
            resolvedBy: true
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const resolveMaintenance = async (id: string, userId: string) => {
    return prismaClient.maintenance.update({
        where: { id },
        data: {
            status: MAINTENANCE_STATUS_ATTENDED,
            resolvedAt: new Date(),
            resolvedById: userId
        },
        include: {
            guard: true,
            resolvedBy: true
        }
    });
};

export const getPendingMaintenancesCount = async () => {
    return prismaClient.maintenance.count({
        where: {
            status: MAINTENANCE_STATUS_PENDING
        }
    });
};

export const getMaintenanceById = async (id: string) => {
    return prismaClient.maintenance.findUnique({
        where: { id },
        include: {
            guard: true,
            resolvedBy: true
        }
    });
};

export const deleteMaintenance = async (id: string) => {
    return prismaClient.maintenance.delete({
        where: { id }
    });
};

export const updateMaintenanceMedia = async (id: string, media: any) => {
    return prismaClient.maintenance.update({
        where: { id },
        data: { media }
    });
};
