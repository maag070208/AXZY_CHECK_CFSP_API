import { prismaClient } from "@src/core/config/database";
import { ROLE_GUARD } from "@src/core/config/constants";

export enum CatalogKey {
    ROLE = 'role',
    CLIENT = 'client',
    LOCATION = 'location',
    GUARD = 'guard',
    INCIDENT_CATEGORY = 'incident_category',
    INCIDENT_TYPE = 'incident_type'
}

export const getCatalog = async (key: string) => {
    console.log(`[CatalogService] Fetching catalog for key: ${key}`);
    const selectFields = { id: true, name: true, value: true };
    try {
        switch (key) {
        case CatalogKey.ROLE:
            return prismaClient.role.findMany({ select: selectFields });
        case CatalogKey.INCIDENT_CATEGORY:
            return prismaClient.incidentCategory.findMany({ 
                select: { ...selectFields, color: true, icon: true, type: true } 
            });
        case CatalogKey.INCIDENT_TYPE:
            return prismaClient.incidentType.findMany({ 
                select: { ...selectFields, categoryId: true } 
            });
        case CatalogKey.CLIENT:
            const clients = await prismaClient.client.findMany({ 
                where: { softDelete: false, active: true },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });
            return clients.map(c => ({ id: c.id, name: c.name, value: c.name }));
        case CatalogKey.LOCATION:
            const locations = await prismaClient.location.findMany({ 
                where: { softDelete: false, active: true },
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });
            return locations.map(l => ({ id: l.id, name: l.name, value: l.name }));
        case CatalogKey.GUARD:
            const guards = await prismaClient.user.findMany({
                where: { 
                    role: { name: ROLE_GUARD }, 
                    softDelete: false,
                    active: true
                },
                select: { id: true, name: true, lastName: true },
                orderBy: { name: 'asc' }
            });
            return guards.map(g => ({ id: g.id, name: g.name, value: `${g.name} ${g.lastName}` }));
        default:
            throw new Error(`Catalog key "${key}" not found`);
    }
  } catch (error: any) {
    console.error(`[CatalogService] Error fetching catalog "${key}":`, error);
    throw error;
  }
};
