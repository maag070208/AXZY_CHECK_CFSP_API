import { prismaClient } from "@src/core/config/database";
import { AppError } from "@src/core/errors/AppError";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { createAuditLog } from "../audit/audit.service";
import { publishActivity } from "@src/core/utils/ably-publisher";

const prisma = prismaClient;

// ── Discipline Categories (stored in IncidentCategory with type="DISCIPLINE") ──
export const getPaginatedCategories = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
  const prismaParams = getPrismaPaginationParams(params);
  const searchVal = String(params.filters?.search || "").trim();
  delete prismaParams.where.search;
  prismaParams.where.type = "DISCIPLINE";
  if (searchVal.length > 0) {
    prismaParams.where.OR = [
      { name: { contains: searchVal, mode: "insensitive" } },
      { value: { contains: searchVal, mode: "insensitive" } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.incidentCategory.findMany({ ...prismaParams }),
    prisma.incidentCategory.count({ where: prismaParams.where }),
  ]);
  return { rows, total };
};

export const createCategory = async (data: any) => {
  return prisma.incidentCategory.create({ data: { ...data, type: "DISCIPLINE" } });
};

export const updateCategory = async (id: string, data: any) => {
  return prisma.incidentCategory.update({ where: { id }, data });
};

export const deleteCategory = async (id: string) => {
  return prisma.incidentCategory.delete({ where: { id } });
};

// ── Discipline Types (stored in IncidentType, category must be type="DISCIPLINE") ──
export const getPaginatedTypes = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
  const prismaParams = getPrismaPaginationParams(params);
  const searchVal = String(params.filters?.search || "").trim();
  delete prismaParams.where.search;
  if (searchVal.length > 0) {
    prismaParams.where.OR = [
      { name: { contains: searchVal, mode: "insensitive" } },
      { value: { contains: searchVal, mode: "insensitive" } },
    ];
  }
  prismaParams.where.category = { type: "DISCIPLINE" };
  const [rows, total] = await Promise.all([
    prisma.incidentType.findMany({ ...prismaParams, include: { category: true } }),
    prisma.incidentType.count({ where: prismaParams.where }),
  ]);
  return { rows, total };
};

export const createType = async (data: any) => {
  return prisma.incidentType.create({ data });
};

export const updateType = async (id: string, data: any) => {
  return prisma.incidentType.update({ where: { id }, data });
};

export const deleteType = async (id: string) => {
  return prisma.incidentType.delete({ where: { id } });
};

// ── Guard Discipline (Notices) ──
const OPERATIONAL_ROLE_NAMES = ["GUARD", "SHIFT", "MAINT"];

export const getPaginatedDisciplines = async (params: ITDataTableFetchParams, userId: string, userRole: string, userClientId: string | null): Promise<ITDataTableResponse<any>> => {
  const prismaParams = getPrismaPaginationParams(params);
  const searchVal = String(params.filters?.search || "").trim();
  delete prismaParams.where.search;

  const where: any = { deletedAt: null };

  if (params.filters?.clientId) {
    where.clientId = params.filters.clientId;
  } else if (userRole === "RESDN" && userClientId) {
    where.clientId = userClientId;
  }

  if (params.filters?.status) {
    where.status = params.filters.status;
  }

  if (params.filters?.guardId) {
    where.guardId = params.filters.guardId;
  }

  if (searchVal.length > 0) {
    where.guard = {
      OR: [
        { name: { contains: searchVal, mode: "insensitive" } },
        { lastName: { contains: searchVal, mode: "insensitive" } },
        { username: { contains: searchVal, mode: "insensitive" } },
      ],
    };
  }

  const orderBy = prismaParams.orderBy || { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.guardDiscipline.findMany({
      skip: prismaParams.skip,
      take: prismaParams.take,
      where,
      orderBy,
      select: {
        id: true,
        guardId: true,
        title: true,
        description: true,
        media: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        guard: { select: { id: true, name: true, lastName: true, username: true } },
        createdBy: { select: { id: true, name: true, lastName: true, username: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
        type: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.guardDiscipline.count({ where }),
  ]);

  return { rows, total };
};

export const createDiscipline = async (data: any, createdById: string) => {
  const guard = await prisma.user.findUnique({
    where: { id: data.guardId },
    include: { role: true },
  });

  if (!guard || !OPERATIONAL_ROLE_NAMES.includes(guard.role.name)) {
    throw new AppError("El usuario seleccionado no es un guardia operativo", 400);
  }

  const record = await prisma.guardDiscipline.create({
    data: {
      guardId: data.guardId,
      title: data.title,
      categoryId: data.categoryId || null,
      typeId: data.typeId || null,
      description: data.description || null,
      media: data.media || [],
      clientId: data.clientId || guard.clientId || null,
      createdById,
    },
    include: {
      guard: { select: { id: true, name: true, lastName: true, username: true } },
      createdBy: { select: { id: true, name: true, lastName: true, username: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
      type: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    userId: createdById,
    module: "GUARD_DISCIPLINE",
    action: "CREATE",
    resourceId: record.id,
  });

  setImmediate(() => {
    publishActivity("discipline", "created", {
      id: record.id,
      title: record.title,
      status: record.status,
      guardId: record.guardId,
      guardName: record.guard
        ? `${record.guard.name} ${record.guard.lastName ?? ""}`.trim()
        : null,
      clientId: record.clientId,
    });
  });

  return record;
};

export const resolveDiscipline = async (id: string, data: { description?: string | null; status: "RESOLVED" | "DISMISSED" }) => {
  const record = await prisma.guardDiscipline.findUnique({ where: { id } });
  if (!record || record.deletedAt) {
    throw new AppError("Registro no encontrado", 404);
  }

  const updated = await prisma.guardDiscipline.update({
    where: { id },
    data: {
      status: data.status,
      description: data.description !== undefined ? data.description : record.description,
    },
    include: {
      guard: { select: { id: true, name: true, lastName: true, username: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
      type: { select: { id: true, name: true } },
    },
  });

  setImmediate(() => {
    publishActivity("discipline", data.status === "RESOLVED" ? "resolved" : "dismissed", {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      guardId: updated.guardId,
      clientId: updated.clientId,
    });
  });

  return updated;
};

export const deleteDiscipline = async (id: string) => {
  const record = await prisma.guardDiscipline.findUnique({ where: { id } });
  if (!record) throw new AppError("Registro no encontrado", 404);

  await prisma.guardDiscipline.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
};
