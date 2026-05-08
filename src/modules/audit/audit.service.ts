import { prismaClient as prisma } from "@src/core/config/database";
import { logger } from "@src/core/utils/logger";

export interface IAuditCreate {
  userId: string;
  module: string;
  action: string;
  resourceId?: string;
  details?: any;
}

/**
 * Registra una acción en la tabla de auditoría
 */
export const createAuditLog = async (data: IAuditCreate) => {
  try {
    let finalUserId = data.userId;

    // Verificar si el usuario existe para evitar errores de FK
    const userExists = await prisma.user.findUnique({
      where: { id: finalUserId },
      select: { id: true }
    });

    if (!userExists) {
        // Si es test o el usuario no existe (e.g. login fallido), usamos un usuario del sistema o el primero disponible
        const systemUser = await prisma.user.findFirst({
            where: { role: { name: 'ADMIN' } },
            select: { id: true }
        });
        finalUserId = systemUser?.id || data.userId; // Fallback to original if no admin found (Prisma will fail anyway if invalid)
    }

    // Registro persistente en DB
    await prisma.auditLog.create({
      data: {
        userId: finalUserId,
        module: data.module,
        action: data.action,
        resourceId: data.resourceId || null,
        details: data.details || {},
      },
    });

    // Log redundante en Winston para trazabilidad en archivos
    logger.info(`AUDIT_LOG: [${data.module}] ${data.action} | User: ${data.userId} | Resource: ${data.resourceId || 'N/A'}`);
  } catch (error) {
    logger.error("AUDIT_LOG_ERROR: No se pudo registrar la auditoría", error);
  }
};
