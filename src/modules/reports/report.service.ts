
import { getErrorMessage } from "@src/core/utils/error.utils";
import { prismaClient } from "@src/core/config/database";
import { TResult } from '@src/core/dto/TResult';
import { OPERATIONAL_ROLES, ROUND_STATUS_COMPLETED } from "@src/core/config/constants";
import { getStartOfDay, getEndOfDay } from "@src/core/utils/date-time.utils";

const prisma = prismaClient;

export interface IGuardReportFilters {
    startDate: string;
    endDate: string;
    guardId?: string;
    clientId?: string;
    userRole?: string;
}


const getGuards = (guardId?: string, clientId?: string) => {
    return prisma.user.findMany({
        where: {
            role: { name: { in: OPERATIONAL_ROLES } },
            active: true,
            softDelete: false,
            ...(guardId ? { id: guardId } : {}),
            ...(clientId ? { rounds: { some: { clientId } } } : {})
        },
        select: { id: true, name: true, lastName: true, role: true }
    });
};

export const getGuardGeneralStats = async (filters: IGuardReportFilters): Promise<TResult<IGuardGeneralStats | null>> => {
    try {
        const { startDate, endDate, guardId, clientId } = filters;
        const start = getStartOfDay(startDate);
        const end = getEndOfDay(endDate);

        const [incidentCount, maintenanceCount, scans, rounds] = await Promise.all([
            prisma.incident.count({
                where: {
                    ...(guardId ? { guardId } : {}),
                    ...(clientId ? { clientId } : {}),
                    createdAt: { gte: start, lte: end }
                }
            }),
            prisma.maintenance.count({
                where: {
                    ...(guardId ? { guardId } : {}),
                    ...(clientId ? { clientId } : {}),
                    createdAt: { gte: start, lte: end }
                }
            }),
            prisma.kardex.count({
                where: {
                    ...(guardId ? { userId: guardId } : {}),
                    ...(clientId ? { location: { clientId } } : {}),
                    timestamp: { gte: start, lte: end }
                }
            }),
            prisma.round.findMany({
                where: {
                    ...(guardId ? { guardId } : {}),
                    ...(clientId ? { clientId } : {}),
                    startTime: { gte: start, lte: end }
                },
                include: {
                    client: {
                        include: { locations: true }
                    }
                }
            })
        ]);

        const allKardex = await prisma.kardex.findMany({
            where: {
                ...(guardId ? { userId: guardId } : {}),
                ...(clientId ? { location: { clientId } } : {}),
                timestamp: { gte: start, lte: end }
            },
            select: { userId: true, timestamp: true, locationId: true }
        });

        let missedScansCount = 0;
        let incompleteRoundsCount = 0;

        for (const round of rounds) {
            if (round.client) {
                const roundEnd = round.endTime || new Date();
                const configLocationIds = round.client.locations.map(l => l.id);
                
                const scannedCount = allKardex.filter(k => 
                    k.userId === round.guardId && 
                    k.timestamp >= round.startTime && 
                    k.timestamp <= roundEnd &&
                    configLocationIds.includes(k.locationId)
                ).length;
                
                const required = configLocationIds.length;
                const missedInThisRound = Math.max(0, required - scannedCount);
                missedScansCount += missedInThisRound;

                if (missedInThisRound > 0 && round.status === ROUND_STATUS_COMPLETED) {
                    incompleteRoundsCount++;
                }
            }
        }

        return {
            success: true,
            data: {
                totalIncidents: incidentCount + maintenanceCount,
                totalScans: scans,
                incompleteRounds: incompleteRoundsCount,
                missedScans: missedScansCount
            },
            messages: []
        };
    } catch (error: unknown) {
        return { success: false, data: null, messages: [getErrorMessage(error)] };
    }
};

export const getTopPerformanceGuards = async (filters: IGuardReportFilters): Promise<TResult<IGuardPerformanceRow[]>> => {
    try {
        const { startDate, endDate, clientId } = filters;
        const start = getStartOfDay(startDate);
        const end = getEndOfDay(endDate);

        const groupData = await prisma.kardex.groupBy({
            by: ['userId'],
            where: {
                timestamp: { gte: start, lte: end },
                user: { role: { name: { in: OPERATIONAL_ROLES } } },
                ...(clientId ? { location: { clientId } } : {})
            },
            _count: { _all: true },
            orderBy: { _count: { userId: 'desc' } },
            take: 5
        });

        const guardIds = groupData.map(g => g.userId);
        const guards = await prisma.user.findMany({
            where: { id: { in: guardIds } },
            select: { id: true, name: true, lastName: true }
        });

        const result = groupData.map(g => {
            const guard = guards.find(u => u.id === g.userId);
            return {
                guardId: g.userId,
                name: guard?.name || 'Unknown',
                lastName: guard?.lastName || '',
                totalScans: g._count._all || 0
            };
        });

        return { success: true, data: result, messages: [] };
    } catch (error: unknown) {
        return { success: false, data: [], messages: [getErrorMessage(error)] };
    }
};

export const getWorkloadComparison = async (filters: IGuardReportFilters): Promise<TResult<IWorkloadRow[]>> => {
    try {
        const { startDate, endDate, clientId } = filters;
        const start = getStartOfDay(startDate);
        const end = getEndOfDay(endDate);

        const guards = await getGuards(undefined, clientId);
        const guardIds = guards.map(g => g.id);

        const [scans, incidents, maintenances, rounds] = await Promise.all([
            prisma.kardex.groupBy({
                by: ['userId'],
                where: { 
                    userId: { in: guardIds }, 
                    timestamp: { gte: start, lte: end },
                    ...(clientId ? { location: { clientId } } : {})
                },
                _count: { _all: true }
            }),
            prisma.incident.groupBy({
                by: ['guardId'],
                where: { 
                    guardId: { in: guardIds }, 
                    createdAt: { gte: start, lte: end },
                    ...(clientId ? { clientId } : {})
                },
                _count: { _all: true }
            }),
            prisma.maintenance.groupBy({
                by: ['guardId'],
                where: { 
                    guardId: { in: guardIds }, 
                    createdAt: { gte: start, lte: end },
                    ...(clientId ? { clientId } : {})
                },
                _count: { _all: true }
            }),
            prisma.round.groupBy({
                by: ['guardId'],
                where: { 
                    guardId: { in: guardIds }, 
                    startTime: { gte: start, lte: end },
                    ...(clientId ? { clientId } : {})
                },
                _count: { _all: true }
            })
        ]);

        const result = guards.map(guard => {
            const scanCount = scans.find(s => s.userId === guard.id)?._count?._all || 0;
            const incCount = incidents.find(i => i.guardId === guard.id)?._count?._all || 0;
            const maintCount = maintenances.find(m => m.guardId === guard.id)?._count?._all || 0;
            const roundCount = rounds.find(r => r.guardId === guard.id)?._count?._all || 0;

            // Simple Workload Metric: Weighted sum of activities
            const workload = (scanCount * 1) + (incCount * 5) + (maintCount * 5) + (roundCount * 10);

            return {
                guardId: guard.id,
                name: guard.name,
                lastName: guard.lastName,
                role: guard.role?.value || '---',
                workload,
                details: { scans: scanCount, reports: incCount + maintCount, rounds: roundCount }
            };
        }).sort((a, b) => b.workload - a.workload);

        return { success: true, data: result, messages: [] };
    } catch (error: unknown) {
        return { success: false, data: [], messages: [getErrorMessage(error)] };
    }
};

export const getActivityDistribution = async (filters: IGuardReportFilters): Promise<TResult<IGuardGeneralStats | null>> => {
    return getGuardGeneralStats(filters);
};

export const getGuardDetailedReport = async (filters: IGuardReportFilters): Promise<TResult<IGuardDetailedRow[]>> => {
    try {
        const { startDate, endDate, guardId, clientId } = filters;
        const start = getStartOfDay(startDate);
        const end = getEndOfDay(endDate);

        const guards = await getGuards(guardId, clientId);
        const guardIds = guards.map(g => g.id);

        const [scansGroupBy, allRounds, allKardex] = await Promise.all([
            prisma.kardex.groupBy({
                by: ['userId'],
                where: { 
                    userId: { in: guardIds }, 
                    timestamp: { gte: start, lte: end },
                    ...(clientId ? { location: { clientId } } : {})
                },
                _count: { _all: true }
            }),
            prisma.round.findMany({
                where: { 
                    guardId: { in: guardIds }, 
                    startTime: { gte: start, lte: end },
                    ...(clientId ? { clientId } : {})
                },
                include: { client: { include: { locations: true } } }
            }),
            prisma.kardex.findMany({
                where: { 
                    userId: { in: guardIds }, 
                    timestamp: { gte: start, lte: end },
                    ...(clientId ? { location: { clientId } } : {})
                },
                select: { userId: true, timestamp: true, locationId: true }
            })
        ]);

        const reportData = guards.map(guard => {
            const guardRounds = allRounds.filter(r => r.guardId === guard.id);
            const guardScansCount = scansGroupBy.find(s => s.userId === guard.id)?._count?._all || 0;
            const guardKardex = allKardex.filter(k => k.userId === guard.id);

            let totalRoundDurationMs = 0;
            let completedRoundsCount = 0;
            let missedScansCount = 0;
            let incompleteRoundsCount = 0;

            for (const round of guardRounds) {
                if (round.status === ROUND_STATUS_COMPLETED && round.endTime) {
                    totalRoundDurationMs += (round.endTime.getTime() - round.startTime.getTime());
                    completedRoundsCount++;
                }

                if (round.client) {
                    const roundEnd = round.endTime || new Date();
                    const configIds = round.client.locations.map((l) => l.id);
                    
                    const scannedInRound = guardKardex.filter(k => 
                        k.timestamp >= round.startTime && 
                        k.timestamp <= roundEnd &&
                        configIds.includes(k.locationId)
                    ).length;

                    const required = configIds.length;
                    const missedInRound = Math.max(0, required - scannedInRound);
                    missedScansCount += missedInRound;

                    if (missedInRound > 0 && round.status === ROUND_STATUS_COMPLETED) {
                        incompleteRoundsCount++;
                    }
                }
            }

            const avgRoundTimeMinutes = completedRoundsCount > 0 
                ? (totalRoundDurationMs / completedRoundsCount) / (1000 * 60)
                : 0;

            return {
                guardId: guard.id,
                name: guard.name,
                lastName: guard.lastName,
                role: guard.role?.value || '---',
                totalRounds: guardRounds.length,
                totalScans: guardScansCount,
                incompleteRounds: incompleteRoundsCount,
                missedScans: missedScansCount,
                avgRoundTimeMinutes: Math.round(avgRoundTimeMinutes * 100) / 100
            };
        });

        return { success: true, data: reportData, messages: [] };
    } catch (error: unknown) {
        return { success: false, data: [], messages: [getErrorMessage(error)] };
    }
};

export const getGuardDetailBreakdown = async (filters: IGuardReportFilters): Promise<TResult<IGuardBreakdown | null>> => {
    try {
        const { startDate, endDate, guardId, clientId } = filters;
        if (!guardId) throw new Error("GuardId is required");

        const start = getStartOfDay(startDate);
        const end = getEndOfDay(endDate);

        const [rounds, allKardex] = await Promise.all([
            prisma.round.findMany({
                where: { 
                    guardId, 
                    startTime: { gte: start, lte: end },
                    ...(clientId ? { clientId } : {})
                },
                include: { client: { include: { locations: true } } }
            }),
            prisma.kardex.findMany({
                where: { 
                    userId: guardId, 
                    timestamp: { gte: start, lte: end },
                    ...(clientId ? { location: { clientId } } : {})
                },
                select: { locationId: true, timestamp: true }
            })
        ]);

        const missedPoints: IMissedPoint[] = [];
        const incompleteRounds: IIncompleteRound[] = [];

        for (const round of rounds) {
            if (!round.client) continue;

            const roundEnd = round.endTime || new Date();
            const scannedIds = new Set(
                allKardex
                    .filter(k => k.timestamp >= round.startTime && k.timestamp <= roundEnd)
                    .map(k => k.locationId)
            );

            const roundMissed = round.client.locations.filter((l) => !scannedIds.has(l.id));

            if (roundMissed.length > 0) {
                if (round.status === ROUND_STATUS_COMPLETED) {
                    incompleteRounds.push({
                        roundId: round.id,
                        startTime: round.startTime,
                        endTime: round.endTime,
                        missedCount: roundMissed.length,
                        totalLocations: round.client.locations.length
                    });
                }

                roundMissed.forEach((l) => {
                    missedPoints.push({
                        roundId: round.id,
                        startTime: round.startTime,
                        locationId: l.id,
                        locationName: l.name,
                        aisle: l.aisle
                    });
                });
            }
        }

        return { success: true, data: { missedPoints, incompleteRounds }, messages: [] };
    } catch (error: unknown) {
        return { success: false, data: null, messages: [getErrorMessage(error)] };
    }
};

import { AdministrativeReportParams } from "./report.dto";
import {
  IGuardGeneralStats, IGuardPerformanceRow, IWorkloadRow, IGuardDetailedRow, IGuardBreakdown,
  IMissedPoint, IIncompleteRound,
} from "./report.response";
import { generateAdministrativeMatrixPDFBuffer, MatrixLocationRow } from "./report.pdf.service";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const generateAdministrativeMatrixReport = async (params: AdministrativeReportParams): Promise<Buffer> => {
    const { recurringConfigurationIds, startDate, endDate } = params;
    const start = getStartOfDay(startDate);
    const end = getEndOfDay(endDate);

    const recurringLocations = await prisma.recurringLocation.findMany({
        where: { recurringConfigurationId: { in: recurringConfigurationIds } },
        include: { location: true },
        orderBy: { location: { name: 'asc' } }
    });

    const locationMap = new Map<string, any>();
    recurringLocations.forEach(rl => {
        if (rl.location && !locationMap.has(rl.location.id)) {
            locationMap.set(rl.location.id, rl.location);
        }
    });

    const locations = Array.from(locationMap.values());
    const locationIds = locations.map(l => l.id);

    const scans = await prisma.kardex.findMany({
        where: {
            locationId: { in: locationIds },
            timestamp: { gte: start, lte: end }
        },
        select: {
            locationId: true,
            timestamp: true,
            media: true
        }
    });

    const rows: MatrixLocationRow[] = locations.map(loc => {
        const row: MatrixLocationRow = {
            locationId: loc.id,
            name: loc.name,
            scansByDay: {}
        };

        const locScans = scans.filter(s => s.locationId === loc.id);

        locScans.forEach(scan => {
            const dayStr = dayjs(scan.timestamp).tz("America/Tijuana").format("YYYY-MM-DD");
            row.scansByDay[dayStr] = true;
        });

        return row;
    });

    return generateAdministrativeMatrixPDFBuffer(startDate, endDate, rows);
};

export interface IIncidentReportFilters {
    startDate: string;
    endDate: string;
    clientId?: string;
}

export interface IIncidentReport {
    total: number;
    pending: number;
    attended: number;
    resolutionRate: number;
    byCategory: Array<{ id: string; name: string; color: string | null; count: number }>;
    byGuard: Array<{ id: string; name: string; count: number }>;
    byDay: Array<{ date: string; count: number }>;
}

/**
 * Resumen analítico de incidencias en un rango de fechas: totales por estado,
 * categoría, guardia y día. Alimenta el reporte "Incidencias" del Centro de Reportes.
 */
export const getIncidentReport = async (
    filters: IIncidentReportFilters,
): Promise<TResult<IIncidentReport | null>> => {
    try {
        const { startDate, endDate, clientId } = filters;
        const start = getStartOfDay(startDate);
        const end = getEndOfDay(endDate);

        const incidents = await prisma.incident.findMany({
            where: {
                deletedAt: null,
                createdAt: { gte: start, lte: end },
                ...(clientId ? { clientId } : {}),
            },
            select: {
                status: true,
                createdAt: true,
                guardId: true,
                guard: { select: { name: true, lastName: true } },
                category: { select: { id: true, name: true, color: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const total = incidents.length;
        const pending = incidents.filter((i) => i.status === "PENDING").length;
        const attended = total - pending;

        const categoryMap = new Map<
            string,
            { id: string; name: string; color: string | null; count: number }
        >();
        const guardMap = new Map<string, { id: string; name: string; count: number }>();
        const dayMap = new Map<string, number>();

        for (const incident of incidents) {
            const catId = incident.category?.id ?? "sin-categoria";
            const existingCat = categoryMap.get(catId);
            if (existingCat) existingCat.count++;
            else
                categoryMap.set(catId, {
                    id: catId,
                    name: incident.category?.name ?? "Sin categoría",
                    color: incident.category?.color ?? null,
                    count: 1,
                });

            const guardName =
                `${incident.guard?.name ?? ""} ${incident.guard?.lastName ?? ""}`.trim() ||
                "Sin asignar";
            const existingGuard = guardMap.get(incident.guardId);
            if (existingGuard) existingGuard.count++;
            else
                guardMap.set(incident.guardId, {
                    id: incident.guardId,
                    name: guardName,
                    count: 1,
                });

            const day = incident.createdAt.toISOString().slice(0, 10);
            dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
        }

        return {
            success: true,
            data: {
                total,
                pending,
                attended,
                resolutionRate: total > 0 ? Math.round((attended / total) * 100) : 0,
                byCategory: [...categoryMap.values()].sort((a, b) => b.count - a.count),
                byGuard: [...guardMap.values()].sort((a, b) => b.count - a.count),
                byDay: [...dayMap.entries()]
                    .map(([date, count]) => ({ date, count }))
                    .sort((a, b) => a.date.localeCompare(b.date)),
            },
            messages: [],
        };
    } catch (error: unknown) {
        return {
            success: false,
            data: null,
            messages: [getErrorMessage(error) || "Error al generar reporte de incidencias"],
        };
    }
};
