# Plan Maestro — Blindaje de la API AXZY CHECK (módulo por módulo)

> Fuente de reglas: skills `axzy-api-standards`, `axzy-api-test-standards`,
> `axzy-swagger-autodoc` (cargados). Este documento es el contrato a seguir en
> cada módulo. No se improvisa: se aplica el mismo checklist a todos.

---

## 0. Estado actual (medido, no supuesto)

Base de pruebas: **local** (`checkapp_test`, Docker), aislada de producción.
`yarn test` usa `.env.test` + `globalSetup` (reset determinista).

| Métrica | Valor |
|---|---:|
| `any` en `src` | 99 (de 237 iniciales) |
| Suites de tests | 29 (25 integración + 5 e2e) |
| Módulos **sin** test de integración | 11 |
| Flujos e2e existentes | 5 |
| Swagger paths | 86 |
| Módulos montados sin swagger | 1 (`catalog`) |
| Tests flaky (aislamiento) | ~11 (raíz ya diagnosticada) |

### Inventario por módulo

`test`: integración · `e2e`: flujo · `sw`: paths swagger · `any`: violaciones restantes

| Módulo | test | e2e | sw | any | Pendiente principal |
|---|---:|---:|---:|---:|---|
| assignments | — | — | 3 | 0 | **test integración + e2e** |
| audit | — | n/a | n/a | 1 | `any` (interno, sin rutas) |
| catalog | — | — | **0** | 0 | **swagger (1 path) + test** |
| clients | ✅ | — | 2 | 13 | `any` (cascade 11) + e2e |
| common | — | n/a | n/a | 1 | `any` (middleware) |
| dashboard | ✅ | — | 2 | 0 | e2e |
| guard-discipline | ✅ | ✅ | 8 | 1 | `any` (createDiscipline) |
| guard-logs | ✅ | ✅ | 3 | 1 | `any` |
| home | — | — | 1 | 2 | **test + e2e** + `any` |
| incidents | ✅ | ✅ | 3 | 5 | `any` |
| kardex | ✅ | — | 2 | 4 | `any` (media JSON) + e2e |
| locations | ✅ | — | 4 | 1 | `any` |
| maintenance | ✅ | ✅ | 3 | 5 | `any` |
| notifications | — | — | 4 | 3 | **test + e2e** + `any` (firebase) |
| panic | — | — | 5 | 2 | **test + e2e** + `any` |
| recurring | ✅ | — | 2 | 0 | e2e |
| report-configurations | — | — | 1 | 0 | **test** |
| reports | ✅ | — | 6 | 2 | `any` (data:null) |
| rounds | ✅ | — | 4 | 14 | `any` (pdf 8 + service 4) + e2e |
| scheduled-notifications | — | — | 5 | 3 | **test + e2e** + `any` |
| schedules | ✅ | — | 2 | 0 | e2e |
| settings | — | — | 6 | 3 | **test** + `any` |
| shift-handovers | ✅ | — | 3 | 0 | e2e |
| shift-plans | ✅ | — | 3 | 0 | e2e |
| storage | ✅ | — | 1 | 0 | — |
| subscription | — | — | 2 | 0 | **test** |
| sync | ✅ | — | 2 | 6 | `any` (prisma dinámico) |
| uniform-checks | ✅ | — | 3 | 0 | e2e |
| users | ✅ | — | 4 | 2 | `any` |
| zones | ✅ | — | 2 | 0 | e2e |

`core/` (fuera de módulos): `database.ts` (12, soft-delete), `emailSender` (6),
`pdf.utils` (2), `AppError` (2), `cron` (2) — `any` defendibles (librerías/Prisma genérico).

---

## 1. Reglas y patrones definitivos

### 1.1 Configuración y constantes

- **NUNCA** hardcodear strings/enums/roles/estados/límites.
- Importar SIEMPRE de `src/core/config/constants.ts`.
- Variables de entorno SOLO de `src/core/config/env.config.ts`.

```ts
// ❌ const ROLE_ADMIN = 'ADMIN';
// ✅ import { ROLE_ADMIN } from '@src/core/config/constants';
```

### 1.2 Tipos y DTOs (type safety)

- **NUNCA** usar `any`.
- Reusar: tipos Prisma, DTOs existentes, interfaces compartidas.
- Si falta → crear `*.dto.ts` (entrada) y `*.response.ts` (salida).
- Entradas: `z.infer<typeof schema>`.
- Salidas: interfaces explícitas.

```ts
// ❌ const data: any = req.body;
// ✅ const data: CreateUserDTO = req.body;
```

### 1.3 Validación (Zod)

- TODAS las entradas pasan por Zod (`modules/[module]/schemas`).
- Mensajes SIEMPRE en español.
- NO validar a mano dentro del controlador.
- Reglas de compatibilidad del compilador:
  - `z.enum([...], { message: "..." })` — **no** `errorMap`.
  - `z.record(z.string(), z.any())` — SIEMPRE ambos argumentos.
  - `z.number({ message: "..." })` — **no** `required_error`.

### 1.4 Controladores (delgados)

- Solo `req`, `res`, `next`. CERO lógica de negocio.
- Patrón: `controller → service → prisma`.

### 1.5 Servicios

- TODA la lógica de negocio aquí.
- `prisma.$transaction` cuando hay múltiples escrituras.
- Usar `select` (optimizar), no `include` indiscriminado.
- Soft delete: NO filtrar `softDelete` a mano (lo hace la extensión).

### 1.6 Errores

- Centralizado: `throw new AppError(...)`.
- NUNCA enviar errores crudos.
- `catch (error: unknown)` + helper `getErrorMessage(error)` (ya creado).

### 1.7 Logging y auditoría

- Winston, NO `console.log`.
- TODA mutación (CREATE/UPDATE/DELETE) registra `createAuditLog`.
- `createAuditLog({ userId, module, action, resourceId, details })`.

### 1.8 Swagger y tests (crítico)

Cada cambio de API (endpoint/request/response/campo) obliga a:

```
código → DTO → Zod → swagger.yaml (ES) → test integración (ES)
```

- `yarn swagger` regenera **solo** `components/schemas`; los **paths** son manuales.
- Wrappers: `TResult[Model]`, `TResultList[Model]`, `TResultDatatable[Model]`.
- Seguridad: excluir `password/hash/salt/secret/token`.

### 1.9 Tests

- Integración: `test/modules/[module]/[module].routes.test.ts`.
- e2e: `test/e2e/[name]-flow.test.ts`.
- Mock de auth: header `user` con JSON.
- Cleanup en `afterAll` (borrado en cascada del cliente).
- Descripciones (`describe`/`it`) y mensajes en **español**.

### 1.10 Seguridad / rendimiento

- Respetar `authenticate` global; no exponer campos sensibles.
- `select` + paginación siempre.

---

## 2. Checklist por módulo (procedimiento idéntico)

Para **cada** módulo, en orden:

1. **Auditar rutas** → comparar `*.routes.ts` contra `swagger.yaml`.
2. **Swagger** → añadir/faltan paths manuales (español, wrapper TResult correcto).
3. **DTO/Zod** → verificar que schemas reflejan todos los campos.
4. **`any`** → eliminar (Prisma types / `z.infer` / `Prisma.XGetPayload`).
5. **Hardcode** → mover a `constants.ts`.
6. **Controladores** → asegurar delgados.
7. **Servicios** → `select`, `$transaction`, audit log en mutaciones.
8. **Test de integración** → crear si falta (`test/modules/[module]/`).
9. **Test e2e** → crear/ampliar flujo multi-módulo si el módulo participa en uno.
10. **Verificar** → `npx tsc --noEmit` + `npx jest test/modules/[module]`.

Definición de **Terminado** (DoD) del módulo:
- `tsc` limpio · test integración verde · swagger documentado · 0 `any` nuevos · mensajes ES.

---

## 3. Orden de ejecución (fases)

### Fase A — Cimentación de tests (1 solo bloque, ya no por módulo)

- [ ] Reescribir tests flaky para aislamiento (raíz: 205 tests comparten base en paralelo).
  - Cada suite crea y limpia su propia data (IDs únicos `Date.now()`).
  - No depender del estado dejado por otra suite.
  - Objetivo: suite 100% verde y determinista.

### Fase B — Módulos sin test de integración (11)

Prioridad por uso en la app (KMP/WEB):

1. notifications (+ e2e)
2. panic (+ e2e)
3. scheduled-notifications (+ e2e)
4. settings
5. home (+ e2e)
6. catalog (+ swagger)
7. assignments (+ e2e de ciclo de estado)
8. report-configurations
9. subscription
10. audit (interno, solo `any`)
11. common (middleware, solo `any`)

### Fase C — `any` restante por módulo (descendente)

1. rounds (14: pdf 8 + service 4 + dto 2)
2. clients (13: cascade 11 — cliente Prisma extendido, evaluar si se deja)
3. sync (6: acceso dinámico a modelos)
4. incidents (5) / maintenance (5)
5. kardex (4) / settings (3) / scheduled (3) / notifications (3)
6. users (2) / home (2) / panic (2) / reports (2)
7. sueltos de 1 (audit, common, guard-discipline, guard-logs, locations)

### Fase D — e2e de flujos faltantes

Flujos multi-módulo a cubrir (además de los 5 existentes):

- **Notificaciones**: enviar → bandeja → marcar leída.
- **Pánico**: crear alerta → listar datatable → resolver.
- **Avisos programados**: crear → datatable → actualizar → eliminar.
- **Asignaciones**: crear → ciclo de estados → historial.
- **Catálogo completo**: cliente → zonas → puntos → guardias → ronda (ya existe `test-ronda-completa`, ampliar).

---

## 4. Convenciones de nomenclatura y archivos

| Elemento | Ubicación / nombre |
|---|---:|
| Entrada (DTO) | `modules/[m]/[m].dto.ts` |
| Salida (response) | `modules/[m]/[m].response.ts` |
| Validación | `modules/[m]/schemas/[m].schema.ts` |
| Rutas | `modules/[m]/[m].routes.ts` |
| Controlador | `modules/[m]/[m].controller.ts` |
| Servicio | `modules/[m]/[m].service.ts` |
| Test integración | `test/modules/[m]/[m].routes.test.ts` |
| Test e2e | `test/e2e/[flujo]-flow.test.ts` |

## 5. Cómo ejecutar

```bash
cd /Users/axzy/DEV/CHECK/FANSAL/API
npx tsc --noEmit                              # tipos
npx jest test/modules/[m]                     # un módulo
npx jest test/e2e/[flujo]-flow.test.ts        # un flujo
yarn swagger                                  # sync schemas (paths manuales)
```

Regla de oro: **nunca** apuntar `DATABASE_URL` a Railway en tests (ya asegurado con `.env.test`).
