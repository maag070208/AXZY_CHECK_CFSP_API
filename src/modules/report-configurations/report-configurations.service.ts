import { getErrorMessage } from "@src/core/utils/error.utils";
import { prismaClient as prisma } from "@src/core/config/database";
import {
  CreateReportConfigurationDTO,
  UpdateReportConfigurationDTO,
} from "./report-configurations.dto";
import { Prisma, ReportConfiguration } from "@prisma/client";
import { TResult } from "@src/core/dto/TResult";

/** Configuración de reporte con su cliente (sólo id y nombre). */
type ReportConfigWithClient = Prisma.ReportConfigurationGetPayload<{
  include: { client: { select: { id: true; name: true } } };
}>;

export const getReportConfigurations = async (
  page = 1,
  limit = 10,
  searchTerm = "",
): Promise<TResult<{ rows: ReportConfigWithClient[]; total: number; page: number; limit: number } | null>> => {
  try {
    const skip = (page - 1) * limit;

    let where: Prisma.ReportConfigurationWhereInput = {};
    if (searchTerm) {
      where.name = { contains: searchTerm, mode: "insensitive" };
    }

    const [rows, total] = await Promise.all([
      prisma.reportConfiguration.findMany({
        where,
        skip,
        take: limit,
        include: { client: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reportConfiguration.count({ where }),
    ]);

    return { success: true, data: { rows, total, page, limit }, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const createReportConfiguration = async (
  data: CreateReportConfigurationDTO,
): Promise<TResult<ReportConfiguration | null>> => {
  try {
    const config = await prisma.reportConfiguration.create({
      data: {
        ...data,
        configuration: data.configuration ?? {},
      },
    });
    return { success: true, data: config, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const updateReportConfiguration = async (
  id: string,
  data: UpdateReportConfigurationDTO,
): Promise<TResult<ReportConfiguration | null>> => {
  try {
    const config = await prisma.reportConfiguration.update({
      where: { id },
      data: {
        ...data,
        configuration: data.configuration ?? undefined,
      },
    });
    return { success: true, data: config, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const deleteReportConfiguration = async (
  id: string,
): Promise<TResult<ReportConfiguration | null>> => {
  try {
    const config = await prisma.reportConfiguration.delete({ where: { id } });
    return { success: true, data: config, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};
