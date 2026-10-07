import dotenv from "dotenv";
import path from "path";
import { execSync } from "child_process";

/**
 * Prepara la base LOCAL de pruebas una sola vez, antes de toda la suite.
 *
 * - Carga `.env.test` (base `checkapp_test`).
 * - `prisma migrate reset --force`: borra el esquema, reaplica migraciones y
 *   vuelve a sembrar (catálogos + demo). Determinista: cada corrida empieza desde
 *   el mismo estado y los tests no heredan residuos de la anterior.
 *
 * Los tests NUNCA tocan Railway ni la base de desarrollo `checkapp`.
 */
export default async (): Promise<void> => {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

  execSync("npx prisma migrate reset --force --skip-generate", {
    stdio: "inherit",
    env: { ...process.env },
    cwd: path.resolve(__dirname, ".."),
  });
};
