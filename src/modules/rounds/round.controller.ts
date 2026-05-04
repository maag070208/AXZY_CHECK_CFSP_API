import { Request, Response } from 'express';
import * as roundService from './round.service';
import { createTResult } from "@src/core/mappers/tresult.mapper";

export const getDataTable = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await roundService.getDataTableRounds(req.body, user);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const startRound = async (req: Request, res: Response) => {
  const { guardId, clientId, recurringConfigurationId } = req.body;
  const user = (req as any).user;
  const targetGuardId = user?.id || guardId;

  const result = await roundService.startRound(String(targetGuardId), clientId as string, recurringConfigurationId as string);
  return res.status(result.success ? 200 : 400).json(result);
};


export const endRound = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await roundService.endRound(id);
  return res.status(result.success ? 200 : 400).json(result);
};

export const getCurrentRound = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
  }
  const result = await roundService.getCurrentRound(String(userId));
  return res.status(result.success ? 200 : 400).json(result);
};

export const getRounds = async (req: Request, res: Response) => {
    // Optional filters like date, or guardId
    const { date, guardId } = req.query;
    const user = (req as any).user;
    const result = await roundService.getRounds(
        date ? String(date) : undefined, 
        guardId as string,
        user
    );
    return res.status(result.success ? 200 : 500).json(result);
};

export const getRoundDetail = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    const result = await roundService.getRoundDetail(id, user);
    return res.status(result.success ? 200 : 404).json(result);
};

export const generateReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const buffer = await roundService.generateRoundPDF(id, user);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Ronda_${id}.pdf`);
        return res.send(buffer);
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message));
    }
};
