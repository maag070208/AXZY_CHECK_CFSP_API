import dotenv from 'dotenv';
import path from 'path';

/**
 * Carga la base LOCAL de pruebas ANTES que cualquier módulo de la app.
 *
 * `dotenv.config()` no sobrescribe variables ya presentes, así que cargando
 * `.env.test` primero, el `dotenv.config()` de la app (que lee `.env` y apunta a
 * producción) no la pisa. Los tests nunca tocan Railway.
 */
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
