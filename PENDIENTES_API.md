# Pendientes de la API — para dejarla "mamalona"

> Estado verificado en vivo. Cada punto trae **archivo + acción + cómo verificar**.
> Lo hecho está marcado ✅; lo que falta, con su detalle exacto.

---

## 0. Estado actual (medido)

```
Test Suites: 42 passed, 42 total
Tests:       269 passed, 269 total   ← determinista (3 corridas seguidas)
tsc --noEmit: limpio
any en src:   40
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
| **`any` reducido 87 → 40** | ✅ (los 40 restantes son defendibles) |

**Los 3 bugs reales que destapó el blindaje:**

1. `clock-in` aceptaba entradas duplicadas (dos turnos abiertos → prenómina incoherente).
2. `round.service` usaba `findUnique` con filtro no-único (`deletedAt`) → **404 en el detalle de ronda**.
3. `panic.service` enviaba un campo FCM inválido (`vibrate` → `vibrateTimingsMillis`).

**Cerrado en la última pasada:**

- `assignments`: test de integración (10) + e2e (6). Era el único módulo con rutas sin test.
- Audit log añadido en: `zones`, `locations`, `schedules`, `settings`, `subscription`, `kardex`, `assignments`.
- Zod añadido en: `subscription PUT /config`, `users POST /fcm-token`, `notifications PATCH /:id/read`.

---

## 1. `any` restante — 40 ocurrencias (todas defendibles o residuales)

Se eliminaron **47** en la última pasada (`rounds`, `incidents`, `maintenance`,
`kardex`, `users`, `reports`, `clients`, controladores, cron, `pdf.utils`,
`emailSender`). Lo que queda:

| Archivo | Nº | Por qué queda |
|---|---:|---|
| `core/config/database.ts` | 12 | Extensión de soft-delete sobre modelos **genéricos** (`$allOperations`) |
| `clients/clients.cascade.ts` | 11 | Cliente Prisma **extendido** (no es `Prisma.TransactionClient`) |
| `sync/sync.service.ts` | 5 | Acceso **dinámico** a modelos (`prismaClient[model]`) |
| `round.service.ts` (`cleanFilters`) | 1 | Filtro dinámico con valores objeto (no encaja en `Record<string, string|number|boolean>`) |
| middlewares / utils | 11 | 1 por archivo, en firmas de Express/`asyncHandler` |

**Conclusión honesta:** son **excepción consciente**. Forzar estos a cero implica
reescribir la extensión de soft-delete y el acceso dinámico a modelos — riesgo
alto, beneficio nulo. Documentados aquí como decisión, no como deuda olvidada.

**Bugs/secretos que se destaparon al tipar:**

- `panic.service`: campo FCM inválido `vibrate` → `vibrateTimingsMillis`.
- `scheduled-notifications.cron`: **API key de Ably hardcodeada** → ahora `env.ABLY_API_KEY`.
- `scheduled-notifications.cron`: `require("firebase-admin")` duplicado → util compartida.
- `emailSender`: `media` era `any` → normalizado a `IEmailMedia[]`.

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
