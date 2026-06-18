import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../../core/utils/security';
import { AppError } from '../../../core/errors/AppError';
import { asyncHandler } from '../../../core/utils/asyncHandler';
import { prismaClient } from '../../../core/config/database';

export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Soporte para tests con mocks
    if (process.env.NODE_ENV === 'test' && req.headers['user']) {
        res.locals.user = JSON.parse(req.headers['user'] as string);
        return next();
    }

    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        token = req.query.token as string | undefined;
    }

    if (!token) {
        throw new AppError('No se proporcionó un token', 401);
    }

    let decoded: any;
    try {
        decoded = await verifyToken(token);
    } catch (error) {
        throw new AppError('Token inválido o expirado', 401);
    }

    const user = await prismaClient.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, active: true, softDelete: true },
    });

    if (!user || !user.active || user.softDelete) {
        throw new AppError('Usuario no encontrado o desactivado', 401);
    }

    res.locals.user = decoded;
    next();
});

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = res.locals.user;
        if (!user || !roles.includes(user.role)) {
            throw new AppError("Acceso denegado: Permisos insuficientes", 403);
        }
        next();
    };
};
