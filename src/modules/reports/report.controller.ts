import { Request, Response } from 'express';
import * as ReportService from './report.service';
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const getGuardStats = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        guardId: req.query.guardId as string,
        clientId: (user.clientId || req.query.clientId) as string,
        userRole: user.role
    };
    const result = await ReportService.getGuardGeneralStats(filters);
    res.json(result);
});

export const getTopPerformance = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        clientId: (user.clientId || req.query.clientId) as string,
        userRole: user.role
    };
    const result = await ReportService.getTopPerformanceGuards(filters);
    res.json(result);
});

export const getActivityDistribution = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        guardId: req.query.guardId as string,
        clientId: (user.clientId || req.query.clientId) as string,
        userRole: user.role
    };
    const result = await ReportService.getActivityDistribution(filters);
    res.json(result);
});

export const getGuardDetailedReport = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        guardId: req.query.guardId as string,
        clientId: (user.clientId || req.query.clientId) as string,
        userRole: user.role
    };
    const result = await ReportService.getGuardDetailedReport(filters);
    res.json(result);
});

export const getGuardDetailBreakdown = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        guardId: req.params.id as string,
        clientId: (user.clientId || req.query.clientId) as string,
        userRole: user.role
    };
    const result = await ReportService.getGuardDetailBreakdown(filters);
    res.status(result.success ? 200 : 400).json(result);
});

export const getWorkloadComparison = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        clientId: (user.clientId || req.query.clientId) as string,
        userRole: user.role
    };
    const result = await ReportService.getWorkloadComparison(filters);
    res.json(result);
});

export const getIncidentReport = asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const endDate =
        (req.query.endDate as string) || new Date().toISOString().slice(0, 10);
    const startDate =
        (req.query.startDate as string) ||
        new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await ReportService.getIncidentReport({
        startDate,
        endDate,
        clientId: (user.clientId || req.query.clientId) as string | undefined,
    });
    res.json(result);
});

export const generateAdministrativeReport = asyncHandler(async (req: Request, res: Response) => {
    const params = req.body;
    try {
        const buffer = await ReportService.generateAdministrativeMatrixReport(params);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename=Matriz_Administrativa_${new Date().getTime()}.pdf`
        );
        res.status(200).send(buffer);
    } catch (error: any) {
        res.status(500).json({ success: false, messages: [error.message], data: null });
    }
});
