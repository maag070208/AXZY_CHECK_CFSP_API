import { prismaClient } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { INCIDENT_STATUS_PENDING } from "@src/core/config/constants";

export const getDataTableIncidents = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
    const prismaParams = getPrismaPaginationParams(params);

    // Handle combined search (if any)
    const searchVal = String(params.filters.search || "").trim();
    if (searchVal.length > 0) {
        delete prismaParams.where.search; // Remove generic search added by util
        prismaParams.where.OR = [
            { title: { contains: searchVal, mode: 'insensitive' } },
            { description: { contains: searchVal, mode: 'insensitive' } },
            { category: { value: { contains: searchVal, mode: 'insensitive' } } },
            { type: { value: { contains: searchVal, mode: 'insensitive' } } }
        ];
    }

    // Handle client filter
    if (params.filters.clientId && params.filters.clientId !== 'ALL') {
        prismaParams.where.clientId = params.filters.clientId;
    }

    const [rows, total] = await Promise.all([
        prismaClient.incident.findMany({
            ...prismaParams,
            include: { 
                guard: true,
                resolvedBy: true,
                category: true,
                type: true,
                client: true
            },
            orderBy: prismaParams.orderBy || { createdAt: 'desc' }
        }),
        prismaClient.incident.count({
            where: prismaParams.where
        })
    ]);

    return { rows, total };
};
import { sendIncidentEmail, sendIncidentWhatsApp } from "@src/core/utils/emailSender";

export const createIncident = async (data: {
    guardId: string;
    title: string;
    categoryId?: string;
    typeId?: string;
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

    const incident = await prismaClient.incident.create({
        data: {
            guardId: data.guardId,
            title: data.title,
            categoryId: data.categoryId,
            typeId: data.typeId,
            description: data.description,
            media: data.media,
            latitude: data.latitude,
            longitude: data.longitude,
            clientId: clientId
        }
    });

    // Fire and forget EVERYTHING including relation fetching
    setImmediate(async () => {
        try {
            const enrichedIncident = await prismaClient.incident.findUnique({
                where: { id: incident.id },
                include: {
                    guard: true,
                    category: true,
                    type: true
                }
            });
            if (enrichedIncident) {
                await sendIncidentEmail(enrichedIncident, enrichedIncident.guard);
                await sendIncidentWhatsApp(enrichedIncident, enrichedIncident.guard);
            }
        } catch (error) {
            console.error("Background incident processing error:", error);
        }
    });

    return incident;
};

export const getIncidentsByGuard = async (guardId: string) => {
    return prismaClient.incident.findMany({
        where: { guardId },
        orderBy: { createdAt: 'desc' }
    });
};

export const getIncidents = async (filters: {
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

    return prismaClient.incident.findMany({
        where: whereClause,
        include: { 
            guard: true,
            resolvedBy: true
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const resolveIncident = async (id: string, userId: string) => {
    return prismaClient.incident.update({
        where: { id },
        data: {
            status: 'ATTENDED',
            resolvedAt: new Date(),
            resolvedById: userId
        },
        include: {
            guard: true,
            resolvedBy: true
        }
    });
};

export const getPendingIncidentsCount = async () => {
    return prismaClient.incident.count({
        where: {
            status: INCIDENT_STATUS_PENDING
        }
    });
};

export const getIncidentById = async (id: string) => {
    return prismaClient.incident.findUnique({
        where: { id },
        include: { guard: true }
    });
};

export const deleteIncident = async (id: string) => {
    return prismaClient.incident.delete({
        where: { id }
    });
};

export const updateIncidentMedia = async (id: string, media: any[]) => {
    return prismaClient.incident.update({
        where: { id },
        data: { media }
    });
};
