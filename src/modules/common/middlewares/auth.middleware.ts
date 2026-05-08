import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../../core/utils/security';
import { AppError } from '../../../core/errors/AppError';
import { asyncHandler } from '../../../core/utils/asyncHandler';

export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Soporte para tests con mocks
    if (process.env.NODE_ENV === 'test' && req.headers['user']) {
        res.locals.user = JSON.parse(req.headers['user'] as string);
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new AppError('No se proporcionó un token', 401);
    }

    const token = authHeader.split(' ')[1]; 
    if (!token) {
        throw new AppError('Formato de token inválido', 401);
    }

    try {
        const decoded = await verifyToken(token);
        res.locals.user = decoded;
        next();
    } catch (error) {
        throw new AppError('Token inválido o expirado', 401);
    }
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
