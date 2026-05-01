import { PrismaClient } from '@prisma/client';
import { hackerLog } from './seeds/logger';

const prisma = new PrismaClient();

async function main() {
    hackerLog.ascii();
    hackerLog.header('Initializing Dynamic Catalogs');


    hackerLog.info('CATALOG', 'Seeding User Roles');
    const roles = [
        { name: 'ADMIN', value: 'Administrador' },
        { name: 'GUARD', value: 'Guardia de Seguridad' },
        { name: 'SHIFT', value: 'Jefe de Guardias' },
        { name: 'RESDN', value: 'Usuario App' },
        { name: 'MAINT', value: 'Mantenimiento' }
    ];
    for (const item of roles) {
        await prisma.role.upsert({
            where: { name: item.name },
            update: { value: item.value },
            create: { name: item.name, value: item.value },
        });
    }
    hackerLog.success('CATALOG', 'User Roles synced');

    hackerLog.divider();
    hackerLog.success('SYSTEM', 'Catalogs seeded successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
