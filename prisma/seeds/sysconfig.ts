import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

export const sysConfigSeed = async (prisma: PrismaClient) => {
    hackerLog.info('SYSTEM', 'Deploying System configurations');
    
    const configs = [
        { key: 'APP_VERSION', value: '1.0.0' },
        { key: 'MAINTENANCE_MODE', value: 'false' },
        { key: 'INCIDENT_EMAIL', value: 'maag070208@gmail.com|asael070208@gmail.com' },
        { key: 'MAINTENANCE_EMAIL', value: 'maag070208@gmail.com|asael070208@gmail.com' },
        { key: 'INCIDENT_WHATSAPP', value: '526645102632' },
        { key: 'MAINTENANCE_WHATSAPP', value: '526645102632' },
        { key: 'APP_UPDATE_URL', value: 'https://axzy.dev/checkapp/download' },
        { key: 'VERSION_LOGS', value: JSON.stringify([
          {
            version: '1.0.1',
            changes: [
              'Edición de clientes y locaciones',
              'Creación y asignación de guardias',
              'Optimización de rutas y horarios',
              'Historial detallado de versiones'
            ]
          }
        ])},
    ];

    for (const config of configs) {
        await prisma.sysConfig.upsert({
            where: { key: config.key },
            update: { value: config.value },
            create: config,
        });
    }

    hackerLog.success('SYSTEM', 'Core parameters configured');
};
