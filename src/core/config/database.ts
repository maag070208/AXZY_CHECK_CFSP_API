import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient();

export const prismaClient = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const softDeleteModels = ['Client', 'Zone', 'User', 'Location', 'RecurringConfiguration'];
        
        if (model && softDeleteModels.includes(model)) {
          // Filter out soft-deleted records for read operations
          if (['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            const a = args as any;
            a.where = a.where || {};
            if (a.where.softDelete === undefined) {
              a.where.softDelete = false;
            }
          }

          // Intercept delete to perform soft delete
          if (operation === 'delete') {
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const where = (args as any).where;
            const updateData: any = { softDelete: true, active: false, deletedAt: new Date() };

            if (model === 'User') {
              const record = await (basePrisma as any).user.findUnique({ where, select: { username: true } });
              if (record && !record.username.includes('_deleted_')) {
                updateData.username = `${record.username}_deleted_${Date.now()}`;
              }
            } else if (model === 'Client') {
              const record = await (basePrisma as any).client.findUnique({ where, select: { name: true } });
              if (record && !record.name.includes('_deleted_')) {
                updateData.name = `${record.name}_deleted_${Date.now()}`;
              }
            }

            return (basePrisma as any)[modelKey].update({
              where,
              data: updateData,
            });
          }

          if (operation === 'deleteMany') {
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const where = (args as any).where;

            if (model === 'User') {
              const records = await (basePrisma as any).user.findMany({ where, select: { id: true, username: true } });
              for (const record of records) {
                if (!record.username.includes('_deleted_')) {
                  await (basePrisma as any).user.update({
                    where: { id: record.id },
                    data: {
                      softDelete: true,
                      active: false,
                      deletedAt: new Date(),
                      username: `${record.username}_deleted_${Date.now()}`,
                    },
                  });
                }
              }
              return { count: records.length };
            } else if (model === 'Client') {
              const records = await (basePrisma as any).client.findMany({ where, select: { id: true, name: true } });
              for (const record of records) {
                if (!record.name.includes('_deleted_')) {
                  await (basePrisma as any).client.update({
                    where: { id: record.id },
                    data: {
                      softDelete: true,
                      active: false,
                      deletedAt: new Date(),
                      name: `${record.name}_deleted_${Date.now()}`,
                    },
                  });
                }
              }
              return { count: records.length };
            }

            return (basePrisma as any)[modelKey].updateMany({
              where,
              data: { softDelete: true, active: false, deletedAt: new Date() },
            });
          }
        }

        return query(args);
      },
    },
  },
});