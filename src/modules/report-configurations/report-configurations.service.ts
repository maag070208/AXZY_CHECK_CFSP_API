import { prismaClient as prisma } from "@src/core/config/database";
import {
  CreateReportConfigurationDTO,
  UpdateReportConfigurationDTO,
} from "./report-configurations.dto";
import { TResult } from "@src/core/dto/TResult";

export const getReportConfigurations = async (
  page = 1,
  limit = 10,
  searchTerm = "",
): Promise<TResult<any>> => {
  try {
    const skip = (page - 1) * limit;

    let where: any = {};
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
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const createReportConfiguration = async (
  data: CreateReportConfigurationDTO,
): Promise<TResult<any>> => {
  try {
    const config = await prisma.reportConfiguration.create({
      data: {
        ...data,
        configuration: data.configuration ?? {},
      },
    });
    return { success: true, data: config, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const updateReportConfiguration = async (
  id: string,
  data: UpdateReportConfigurationDTO,
): Promise<TResult<any>> => {
  try {
    const config = await prisma.reportConfiguration.update({
      where: { id },
      data: {
        ...data,
        configuration: data.configuration ?? undefined,
      },
    });
    return { success: true, data: config, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const deleteReportConfiguration = async (
  id: string,
): Promise<TResult<any>> => {
  try {
    const config = await prisma.reportConfiguration.delete({ where: { id } });
    return { success: true, data: config, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};
