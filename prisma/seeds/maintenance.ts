import { PrismaClient } from "@prisma/client";
import { hackerLog } from "./logger";

export const maintenanceCatalogsSeed = async (prisma: PrismaClient) => {
    hackerLog.info('SEED', 'Populating Maintenance Categories and Types...');

    const categories = [
        {
            name: 'MANTENIMIENTO_GRAL',
            value: 'Mantenimiento General',
            type: 'MAINTENANCE',
            color: '#F59E0B',
            icon: 'wrench',
            types: [
                { name: 'FUGA_AGUA', value: 'Fuga de Agua' },
                { name: 'FALLA_ELECTRICA', value: 'Falla Eléctrica' },
                { name: 'ELEVADOR', value: 'Elevador Atascado' },
                { name: 'LUMINARIA', value: 'Luminaria Fundida' },
                { name: 'PORTON', value: 'Portón Averiado' },
                { name: 'INFRAESTRUCTURA', value: 'Baches / Grietas' }
            ]
        },
        {
            name: 'LIMPIEZA',
            value: 'Limpieza y Áreas Verdes',
            type: 'MAINTENANCE',
            color: '#10B981',
            icon: 'leaf',
            types: [
                { name: 'PISCINA', value: 'Limpieza de Piscina' },
                { name: 'JARDINERIA', value: 'Poda de Árboles / Jardín' },
                { name: 'BASURA_EXT', value: 'Recolección de Basura' },
                { name: 'PLAGA', value: 'Control de Plagas' },
                { name: 'PINTURA', value: 'Retoque de Pintura' },
                { name: 'LIMPIEZA_AREA', value: 'Limpieza de Áreas Comunes' }
            ]
        }
    ];

    for (const cat of categories) {
        const { types, ...catData } = cat;
        const createdCat = await prisma.incidentCategory.upsert({
            where: { name: catData.name },
            update: catData,
            create: catData
        });

        for (const type of types) {
            await prisma.incidentType.upsert({
                where: { name: type.name },
                update: { ...type, categoryId: createdCat.id },
                create: { ...type, categoryId: createdCat.id }
            });
        }
    }

    hackerLog.success('SEED', 'Maintenance Catalogs populated');
};
