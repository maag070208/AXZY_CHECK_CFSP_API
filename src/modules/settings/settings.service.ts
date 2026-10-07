import { Prisma, IncidentCategory, IncidentType, SysConfig } from "@prisma/client";
import { prismaClient } from "@src/core/config/database";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { createAuditLog } from "../audit/audit.service";

// Incident Categories
export const getPaginatedIncidentCategories = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<IncidentCategory>> => {
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

export const createIncidentCategory = async (data: Prisma.IncidentCategoryUncheckedCreateInput, userId: string) => {
    const record = await prismaClient.incidentCategory.create({ data });
    await createAuditLog({ userId, module: "SETTINGS", action: "CREATE_CATEGORY", resourceId: record.id, details: { name: record.name } });
    return record;
};

export const updateIncidentCategory = async (id: string, data: Prisma.IncidentCategoryUncheckedUpdateInput, userId: string) => {
    const record = await prismaClient.incidentCategory.update({ where: { id }, data });
    await createAuditLog({ userId, module: "SETTINGS", action: "UPDATE_CATEGORY", resourceId: id });
    return record;
};

export const deleteIncidentCategory = async (id: string, userId: string) => {
    const record = await prismaClient.incidentCategory.delete({ where: { id } });
    await createAuditLog({ userId, module: "SETTINGS", action: "DELETE_CATEGORY", resourceId: id });
    return record;
};

// Incident Types
export const getPaginatedIncidentTypes = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<Prisma.IncidentTypeGetPayload<{ include: { category: true } }>>> => {
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

export const createIncidentType = async (data: Prisma.IncidentTypeUncheckedCreateInput, userId: string) => {
    const record = await prismaClient.incidentType.create({ data });
    await createAuditLog({ userId, module: "SETTINGS", action: "CREATE_TYPE", resourceId: record.id, details: { name: record.name } });
    return record;
};

export const updateIncidentType = async (id: string, data: Prisma.IncidentTypeUncheckedUpdateInput, userId: string) => {
    const record = await prismaClient.incidentType.update({ where: { id }, data });
    await createAuditLog({ userId, module: "SETTINGS", action: "UPDATE_TYPE", resourceId: id });
    return record;
};

export const deleteIncidentType = async (id: string, userId: string) => {
    const record = await prismaClient.incidentType.delete({ where: { id } });
    await createAuditLog({ userId, module: "SETTINGS", action: "DELETE_TYPE", resourceId: id });
    return record;
};

// SysConfig
export const getPaginatedSysConfig = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<SysConfig>> => {
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
            orderBy: prismaParams.orderBy as Prisma.SysConfigOrderByWithRelationInput
        }),
        prismaClient.sysConfig.count({ where: prismaParams.where })
    ]);
    return { rows, total };
};

export const updateSysConfig = async (key: string, value: string, userId: string) => {
    const record = await prismaClient.sysConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
    await createAuditLog({ userId, module: "SETTINGS", action: "UPDATE_SYSCONFIG", resourceId: key, details: { key } });
    return record;
};

export const deleteSysConfig = async (key: string, userId: string) => {
    const record = await prismaClient.sysConfig.delete({ where: { key } });
    await createAuditLog({ userId, module: "SETTINGS", action: "DELETE_SYSCONFIG", resourceId: key, details: { key } });
    return record;
};
