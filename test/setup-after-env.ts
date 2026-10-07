import { prismaClient } from "@src/core/config/database";

/**
 * Cierra el pool de Prisma al terminar CADA archivo de test.
 *
 * Jest aísla cada archivo en su propio contexto VM, así que `database.ts` se
 * re-evalúa y crea un `PrismaClient` (con su propio pool) por archivo. Sin este
 * cierre, los pools se acumulan y Postgres revienta con
 * `FATAL: sorry, too many clients already`.
 *
 * `setupFilesAfterEnv` corre por archivo y después de instalar el framework, por
 * lo que es el sitio correcto para registrar el `afterAll` global.
 */
afterAll(async () => {
  await prismaClient.$disconnect().catch(() => {});
});
