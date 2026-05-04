import { prismaClient } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";

// Incident Categories
export const getPaginatedIncidentCategories = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
    const prismaParams = getPrismaPaginationParams(params);
    const searchVal = String(params.filters.search || "").trim();
    delete prismaParams.where.search; // Remove search from filters to avoid Prisma error
    if (searchVal.length > 0) {
        prismaParams.where.OR = [
            { name: { contains: searchVal, mode: 'insensitive' } },
            { value: { contains: searchVal, mode: 'insensitive' } }
        ];
    }
    const [rows, total] = await Promise.all([
        prismaClient.incidentCategory.findMany({ ...prismaParams }),
        prismaClient.incidentCategory.count({ where: prismaParams.where })
    ]);
    return { rows, total };
};

export const createIncidentCategory = async (data: any) => {
    return prismaClient.incidentCategory.create({ data });
};

export const updateIncidentCategory = async (id: string, data: any) => {
    return prismaClient.incidentCategory.update({ where: { id }, data });
};

export const deleteIncidentCategory = async (id: string) => {
    return prismaClient.incidentCategory.delete({ where: { id } });
};

// Incident Types
export const getPaginatedIncidentTypes = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
    const prismaParams = getPrismaPaginationParams(params);
    const searchVal = String(params.filters.search || "").trim();
    delete prismaParams.where.search; // Remove search from filters to avoid Prisma error
    if (searchVal.length > 0) {
        prismaParams.where.OR = [
            { name: { contains: searchVal, mode: 'insensitive' } },
            { value: { contains: searchVal, mode: 'insensitive' } }
        ];
    }
    const [rows, total] = await Promise.all([
        prismaClient.incidentType.findMany({ 
            ...prismaParams,
            include: { category: true }
        }),
        prismaClient.incidentType.count({ where: prismaParams.where })
    ]);
    return { rows, total };
};

export const createIncidentType = async (data: any) => {
    return prismaClient.incidentType.create({ data });
};

export const updateIncidentType = async (id: string, data: any) => {
    return prismaClient.incidentType.update({ where: { id }, data });
};

export const deleteIncidentType = async (id: string) => {
    return prismaClient.incidentType.delete({ where: { id } });
};

// SysConfig
export const getPaginatedSysConfig = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
    const prismaParams = getPrismaPaginationParams(params);
    const searchVal = String(params.filters.search || "").trim();
    delete prismaParams.where.search; // Remove search from filters to avoid Prisma error
    if (searchVal.length > 0) {
        prismaParams.where.OR = [
            { key: { contains: searchVal, mode: 'insensitive' } },
            { value: { contains: searchVal, mode: 'insensitive' } }
        ];
    }

    // SysConfig does not have an 'id' field, so we must ensure a valid orderBy
    if (!params.sort?.key) {
        prismaParams.orderBy = { key: 'asc' };
    }

    const [rows, total] = await Promise.all([
        prismaClient.sysConfig.findMany({ 
            skip: prismaParams.skip,
            take: prismaParams.take,
            where: prismaParams.where,
            orderBy: prismaParams.orderBy as any
        }),
        prismaClient.sysConfig.count({ where: prismaParams.where })
    ]);
    return { rows, total };
};

export const updateSysConfig = async (key: string, value: string) => {
    return prismaClient.sysConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
};

export const deleteSysConfig = async (key: string) => {
    return prismaClient.sysConfig.delete({ where: { key } });
};
