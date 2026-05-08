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
            return (basePrisma as any)[modelKey].update({
              where: (args as any).where,
              data: { softDelete: true, active: false, deletedAt: new Date() },
            });
          }

          if (operation === 'deleteMany') {
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            return (basePrisma as any)[modelKey].updateMany({
              where: (args as any).where,
              data: { softDelete: true, active: false, deletedAt: new Date() },
            });
          }
        }

        return query(args);
      },
    },
  },
});