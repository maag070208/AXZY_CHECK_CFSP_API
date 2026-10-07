# Pendientes de la API — para dejarla "mamalona"

> Estado verificado en vivo. Cada punto trae **archivo + acción + cómo verificar**.
> Lo hecho está marcado ✅; lo que falta, con su detalle exacto.

---

## 0. Estado actual (medido)

```
Test Suites: 42 passed, 42 total
Tests:       269 passed, 269 total   ← determinista
tsc --noEmit: limpio
any en src:   87
```

### ✅ Ya blindado

| Frente | Estado |
|---|---|
| Tests aislados de producción (Railway) | ✅ base local `checkapp_test` |
| Reset determinista antes de cada corrida | ✅ `test/global-setup.ts` |
| **Agotamiento de conexiones Prisma** (causa raíz de la flakiness) | ✅ `test/setup-after-env.ts` |
| Bugs reales corregidos | ✅ 3 |
| Roles hardcodeados → `constants.ts` | ✅ |
| Tipo `AuthenticatedUser` + helper `getAuthUserId` | ✅ |
| Swagger: todos los módulos montados documentados | ✅ 86 paths |
| **Tests de integración: 100% de módulos con rutas** | ✅ (solo `audit`/`common` sin test, son internos) |
| **e2e de flujos** | ✅ 10 flujos |
| **Audit log en TODAS las mutaciones** | ✅ (7 módulos que faltaban, corregidos) |
| **Validación Zod en todas las entradas con payload** | ✅ |

**Los 3 bugs reales que destapó el blindaje:**

1. `clock-in` aceptaba entradas duplicadas (dos turnos abiertos → prenómina incoherente).
2. `round.service` usaba `findUnique` con filtro no-único (`deletedAt`) → **404 en el detalle de ronda**.
3. `panic.service` enviaba un campo FCM inválido (`vibrate` → `vibrateTimingsMillis`).

**Cerrado en la última pasada:**

- `assignments`: test de integración (10) + e2e (6). Era el único módulo con rutas sin test.
- Audit log añadido en: `zones`, `locations`, `schedules`, `settings`, `subscription`, `kardex`, `assignments`.
- Zod añadido en: `subscription PUT /config`, `users POST /fcm-token`, `notifications PATCH /:id/read`.

---

## 1. ⏳ `any` restante — 87 ocurrencias

Es lo único grande que queda. Se divide en **defendibles** y **tipables**.

### 1.1 Defendibles (librerías externas / Prisma genérico) — ~40

| Archivo | Nº | Por qué es defendible |
|---|---:|---|
| `core/config/database.ts` | 12 | Extensión de soft-delete sobre modelos **genéricos** (`$allOperations`) |
| `clients/clients.cascade.ts` | 11 | Cliente Prisma **extendido** (no es `Prisma.TransactionClient`) |
| `core/utils/emailSender.ts` | 6 | SDK de email + payloads HTML |
| `sync/sync.service.ts` | 5 | Acceso **dinámico** a modelos (`prismaClient[model]`) |
| `core/utils/pdf.utils.ts` | 2 | Tipos de librería PDF |
| `core/errors/AppError.ts` | 2 | `stack` opcional del error |
| `core/cron/scheduled-notifications.cron.ts` | 2 | Callbacks del cron |

> Recomendación: documentarlos como **excepción consciente** con un comentario.
> Forzarlos a cero implica reescribir la extensión de soft-delete (riesgo alto,
> beneficio bajo).

### 1.2 Tipables — ~47 (el trabajo real)

| Archivo | Nº | Qué tipar |
|---|---:|---|
| `rounds/round.pdf.service.ts` | 8 | Payload del PDF de ronda |
| `rounds/round.service.ts` | 4 | `(s as any).assignment`, mappers |
| `maintenance/maintenance.service.ts` | 3 | `whereClause`, media |
| `incidents/incident.service.ts` | 3 | `whereClause`, filtros |
| `rounds/round.dto.ts` | 2 | `round: any` del detalle |
| `kardex/kardex.service.ts` | 2 | `media?: any[]` (campo `Json?`) |
| `kardex/kardex.response.ts` | 2 | `media` en la respuesta |
| `clients/clients.service.ts` | 2 | filtros |
| `users/user.service.ts` | 1 | `data` de update |
| `users/user.response.ts` | 1 | campo de respuesta |
| `reports/report.service.ts` | 1 | `data: null as any` |
| `reports/report.pdf.service.ts` | 1 | payload PDF |
| `maintenance/maintenance.response.ts` | 1 | `media` |
| `maintenance/maintenance.controller.ts` | 1 | `filters` de query |
| `locations/locations.controller.ts` | 1 | buffer de PDF |
| `incidents/incident.response.ts` | 1 | `media` |
| `incidents/incident.controller.ts` | 1 | `filters` de query |
| `sync/sync.controller.ts` | 1 | payload del push |

**Patrones a usar:**

- Resultados con relaciones → `Prisma.XGetPayload<{ include: ... }>`
- Filtros → `Prisma.XWhereInput`
- Entradas → `z.infer<typeof schema>["body"]`
- Campos `Json?` → `Prisma.InputJsonValue` (entrada) / `Prisma.JsonValue` (salida)
- Params que varían (include vs select) → interfaz explícita en `*.response.ts`

---

## 2. Opcional (mejora, no deuda)

| Punto | Detalle |
|---|---|
| **e2e de supervisión** | plan de turno → entrega → uniforme → agenda cumplida (multi-módulo) |
| **Índices Prisma** | revisar `@@index` en tablas con filtros frecuentes (`kardex.timestamp`, `assignment.status`) |
| **Tests de `audit`** | hoy es un servicio sin rutas; se cubre indirectamente |

---

## 3. Checklist de "terminado" por cada punto

1. `npx tsc --noEmit` limpio.
2. `npx jest test/modules/<m>` verde.
3. `yarn swagger` si cambió algún schema/DTO.
4. Suite completa verde: `npx jest --watchman=false` → 269+ tests.
5. Mensajes (Zod, errores, tests) **en español**.

---

## 4. Nota operativa (importante)

Las pruebas corren contra **Postgres local en Docker**, no contra Railway:

```bash
colima start              # el daemon de Docker debe estar arriba
docker start checkapp-pg  # contenedor con checkapp_test
npx jest --watchman=false # --watchman=false evita el sandbox de ~/.local/state
```

Si Colima o el contenedor están apagados, Jest falla con
`P1001: Can't reach database server at localhost:55432`.

---

## 5. Orden recomendado

1. **`any` tipables por servicio** (~47): empezar por `rounds`, `kardex`, `incidents`, `maintenance`.
2. **Documentar los `any` defendibles** (~40) como excepción consciente.
3. **Opcionales**: e2e de supervisión, índices.
