import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Singleton global del cliente EXTENDIDO.
 *
 * Jest usa `resetModules: true`, por lo que cada archivo de test re-ejecuta este
 * módulo. Cachear SOLO el cliente base no basta: `$extends()` crea un wrapper
 * nuevo (con su propio engine/pool) en cada re-ejecución. Por eso guardamos el
 * cliente extendido COMPLETO en `globalThis`, de modo que todos los archivos
 * (y workers seriales) compartan un único pool → evita "too many clients".
 */
const globalForPrisma = globalThis as unknown as {
  __prisma?: ReturnType<typeof buildExtendedClient>;
};

/**
 * Vista laxa del cliente base para el acceso **dinámico** por nombre de modelo
 * (`basePrisma[modelo]`). La extensión opera sobre modelos genéricos, así que no
 * se puede indexar con un tipo concreto.
 */
interface ISoftDeleteDelegate {
  update: (args: Record<string, unknown>) => Promise<unknown>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
}
type TDynamicBasePrisma = Record<string, ISoftDeleteDelegate>;

/** Argumentos genéricos de una operación extendida. */
type TQueryArgs = { where?: Record<string, unknown> };

function buildExtendedClient() {
  const basePrisma = new PrismaClient();

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const softDeleteModels = ['Client', 'Zone', 'User', 'Location', 'RecurringConfiguration'];

          if (model && softDeleteModels.includes(model)) {
            // Filter out soft-deleted records for read operations
            if (['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              const a = args as unknown as TQueryArgs;
              a.where = a.where || {};
              if (a.where.softDelete === undefined) {
                a.where.softDelete = false;
              }
            }

            // Intercept delete to perform soft delete
            if (operation === 'delete') {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              const where = (args as unknown as TQueryArgs).where as Record<string, unknown>;
              const updateData: Record<string, unknown> = { softDelete: true, active: false, deletedAt: new Date() };

              if (model === 'User') {
                const record = await basePrisma.user.findUnique({ where: where as Prisma.UserWhereUniqueInput, select: { username: true } });
                if (record && !record.username.includes('_deleted_')) {
                  updateData.username = `${record.username}_deleted_${Date.now()}`;
                }
              } else if (model === 'Client') {
                const record = await basePrisma.client.findUnique({ where: where as Prisma.ClientWhereUniqueInput, select: { name: true } });
                if (record && !record.name.includes('_deleted_')) {
                  updateData.name = `${record.name}_deleted_${Date.now()}`;
                }
              }

              return (basePrisma as unknown as TDynamicBasePrisma)[modelKey].update({
                where,
                data: updateData,
              });
            }

            if (operation === 'deleteMany') {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              const where = (args as unknown as TQueryArgs).where as Record<string, unknown>;

              if (model === 'User') {
                const records = await basePrisma.user.findMany({ where: where as Prisma.UserWhereInput, select: { id: true, username: true } });
                for (const record of records) {
                  if (!record.username.includes('_deleted_')) {
                    await basePrisma.user.update({
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
                const records = await basePrisma.client.findMany({ where: where as Prisma.ClientWhereInput, select: { id: true, name: true } });
                for (const record of records) {
                  if (!record.name.includes('_deleted_')) {
                    await basePrisma.client.update({
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

              return (basePrisma as unknown as TDynamicBasePrisma)[modelKey].updateMany({
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
}

export const prismaClient = globalForPrisma.__prisma ?? buildExtendedClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prismaClient;
}
