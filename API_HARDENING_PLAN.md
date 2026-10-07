# Plan de blindaje de la API — AXZY CHECK

> Objetivo: API endurecida (type-safe, sin hardcoding, auditada), con e2e de todos
> los flujos y Swagger al 100%, bajo patrón vertical slice.
>
> Skills cargados: `axzy-api-standards`, `axzy-api-test-standards`,
> `axzy-swagger-autodoc`.

---

## 0. Estado medido (no supuesto)

**Hallazgo de raíz (importante)**: la suite de tests es *flaky* porque los 205
tests **comparten una única base** y Jest los ejecuta **en paralelo** (un worker
por archivo), con dependencias cruzadas entre archivos. Ni el reset determinista
ni `--runInBand` lo resuelven (el serial llegó a empeorarlo: 19 fallos). La
solución correcta es reescribir los tests para que cada archivo cree y limpie su
propia data con identificadores únicos, sin depender del estado que deja otro.

**Progreso de esta tanda**:

- Base local `checkapp_test` (Docker) + `.env.test` + `test/setup-env.ts` +
  `test/global-setup.ts` (reset determinista: `migrate reset --force` + seed).
- Dos bugs reales corregidos:
  1. `clock-in` no rechazaba entradas duplicadas (creaba un segundo registro
     abierto). Añadido chequeo `findFirst({ logoutAt: null })` → `AppError`.
  2. `round.service`: `findUnique({ where: { id, deletedAt: null } })` es inválido
     (Prisma no permite campos no-únicos en `findUnique`), lanzaba error y se
     traducía en 404. Cambiado a `findFirst` en `getRoundDetail` y `deleteRound`.
- `tsc --noEmit` limpio; los 3 suites afectados pasan (31 tests).

---

## 0. Estado medido (no supuesto)

### Infraestructura segura de tests — ✅ HECHO

- **Problema resuelto**: `.env` apunta a `DATABASE_URL` de **Railway (producción)**.
  Los tests corrían contra producción.
- **Solución**:
  - Base Postgres local ya existía en Docker: contenedor `checkapp-pg`
    (`postgres:postgres@localhost:55432/checkapp`), con 37 migraciones aplicadas y
    seed (5 roles, 68 usuarios, 40 clientes).
  - `API/.env.test` → `postgresql://postgres:postgres@localhost:55432/checkapp`.
  - `test/setup-env.ts` carga `.env.test` **antes** que la app; como
    `dotenv.config()` no sobrescribe variables ya presentes, la app no vuelve a
    cargar `.env`. Verificado: los tests ya no tocan Railway.

### Línea base de tests

```
Test Suites: 25 passed, 4 failed, 29 total
Tests:       195 passed, 10 failed, 205 total
```

Los 10 fallos son **preexistentes** y de **aislamiento entre tests** (al correr
`schedules` solo pasa; en la suite completa falla por orden/estado compartido), no
bugs de producto:

| Cluster | Fallos | Causa probable |
|---|---:|---|
| schedules | 6 | estado compartido con otra suite |
| guard-logs (+flow) | 2 + 5 | el seed deja una entrada abierta |
| incidents-flow | 1 | shape del datatable |
| test-ronda-completa | 1 | 404 en endpoint de ronda |
| live-dashboard | 1 | fixture de cliente limitado |

### Scan de violaciones (axzy-api-standards)

| Violación | Cantidad |
|---|---:|
| `any` / `as any` en `src` | **237** |
| `console.log` | 0 (usan Winston ✅) |
| roles hardcodeados (`'ADMIN'`…) fuera de constants | 8 |
| `constants.ts` | existe (163 líneas, ROLES…) |

### Swagger

- `swagger.yaml`: 8.330 líneas, **59 paths**.
- Autodoc: `yarn swagger` (script `scripts/autodoc_prisma.js`) genera schemas,
  **no** los paths manuales.
- Falta auditar cobertura contra los **31 módulos** del router.

---

## 1. Fases

### Fase 1 — Vertical slice (endurecer el código)

Los módulos ya son verticales (`controller / service / routes / schemas` por
módulo). El trabajo es corregir violaciones:

1. **Eliminar los 237 `any`** — tipar con DTOs (`*.dto.ts`, `*.response.ts`) y
   `z.infer<typeof schema>`. Prioridad: controladores y servicios.
2. **Mover los 8 roles hardcodeados** a `constants.ts`.
3. **Auditar controladores**: que sean delgados (sólo req/res/next), sin lógica.
4. **Auditar mutaciones**: que registren audit log (`createAuditLog`).

### Fase 2 — Tests e2e de todos los flujos

Módulos **sin** test de integración (12):

`assignments, audit, catalog, home, notifications, panic,
report-configurations, scheduled-notifications, settings, subscription, common,
index`

Flujos e2e existentes (5): mantenimientos, ronda completa, guard-logs, incidents,
guard-discipline.

Flujos e2e a añadir: **notificaciones (enviar + bandeja + marcar leída),
avisos programados, panic, asignaciones (alta + ciclo de estado), catálogo
(clientes→zonas→puntos), reportes** y los 12 módulos sin test.

También: **corregir los 10 tests flaky** (aislamiento: limpiar/crear su propio
estado en `beforeEach`, no depender del orden).

### Fase 3 — Swagger al 100 %

1. `yarn swagger` para regenerar schemas.
2. Auditar paths faltantes contra los 31 módulos.
3. Documentar los paths manuales en español, con `TResult` variants correctos
   (`TResult`, `TResultList`, `TResultDatatable`).
4. Mantener `react_llm_reference.txt` en sync.

---

## 2. Cómo se ejecuta

- Tests: `cd API && npx jest` (usa `.env.test` → local).
- Un solo archivo: `npx jest test/modules/<modulo>/<modulo>.routes.test.ts`.
- Swagger: `yarn swagger`.
- Regla: **nunca** apuntar `DATABASE_URL` a Railway en tests.
