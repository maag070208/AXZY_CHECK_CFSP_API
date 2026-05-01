import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

export const catalogsSeed = async (prisma: PrismaClient) => {
    hackerLog.info('CATALOG', 'Initializing Base Catalogs');

    // 1. Roles
    const roles = [
        { name: 'ADMIN', value: 'Administrador' },
        { name: 'GUARD', value: 'Guardia' },
        { name: 'SHIFT', value: 'Jefe de Turno' },
        { name: 'MAINT', value: 'Mantenimiento' },
        { name: 'RESDN', value: 'Usuario App' },
    ];

    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: { value: role.value },
            create: role,
        });
    }



    hackerLog.success('CATALOG', 'Base catalogs synchronized');
};
