# Estado de la API — verificación en vivo

> Última verificación: corrida completa de la suite + `tsc` + auditoría de rutas/contratos.
> Todo lo de abajo está **medido**, no estimado.

---

## 0. Estado actual (medido)

```
Test Suites: 46 passed, 46 total          (antes: 42)
Tests:       451 passed, 451 total        (antes: 269)
tsc --noEmit: limpio
Swagger drift: 0 (165 endpoints en código == 165 en swagger.yaml)
Cobertura de endpoints: 165/165 con test de integración directo   (antes: 126/165)
`any` en src: 9 (todos `z.record(z.string(), z.any())` o comentarios)
Audit log: todos los módulos con mutaciones persistentes cubiertos (12 endpoints corregidos)
Cola offline: 16 escenarios de fallo/reintento en `test/modules/sync/sync.queue.test.ts`
APP (jest): 17 tests (antes 8), incluidos 9 de la cola offline
```

Comandos de verificación:

```bash
cd API
npx tsc --noEmit                 # limpio
npx jest --watchman=false         # 45 suites / 434 tests
node scripts/autodoc_prisma.js   # regenera schemas + react_llm_reference.txt
```

---

## 1. Bugs reales corregidos en esta pasada (13)

Estos salieron del blindaje (tests por endpoint + auditoría de contratos), no de suposiciones.

| # | Bug | Impacto | Archivo |
|---|---|---|---|
| 1 | `DELETE /{incidents,maintenance,kardex}/:id/media` era **no-op silencioso**: el schema acepta `media: string[]`, pero el filtro sólo entendía objetos `{key,url}` → respondía `200 {success:true}` **sin borrar nada** | Pérdida de datos falsa: el cliente creía haber borrado | `core/utils/media.utils.ts` (nuevo) + 3 controladores |
| 2 | `DELETE /incidents/:id/media` borraba en S3 el `key` del query **sin comprobar que perteneciera a la incidencia** | Cualquier usuario autenticado podía borrar objetos arbitrarios del bucket | `incidents/incident.controller.ts` (y kardex) |
| 3 | `GET /users/:id` devolvía el **hash bcrypt** de la contraseña | Fuga de credenciales | `users/user.service.ts` (`getUserById` ahora es seguro) |
| 4 | `POST /maintenance/datatable` **sin `authenticate`** | Endpoint público con datos de clientes | `maintenance/maintenance.routes.ts` |
| 5 | Búsqueda de `/locations/datatable` con `$queryRawUnsafe` e **interpolación de strings** (SQLi) y además rota (`ILIKE unaccent(%texto%)` → error 42601, siempre caía al fallback) | Riesgo de inyección SQL + código muerto | `locations/locations.service.ts` (ruta raw eliminada; se conserva el fallback, que ya devolvía la forma correcta) |
| 6 | `GET /dashboard/overview` con usuario RESDN devolvía **400** (`Unknown argument clientId`): se aplicaba `clientId` al modelo `Assignment`, que no lo tiene | Dashboard inutilizable para clientes | `dashboard/dashboard.service.ts` |
| 7 | Un RESDN **sin `clientId`** veía datos de **todas** las empresas (filtro fail-open) en dashboard, home, incidents, maintenance, panic, users, rounds y attendance | Fuga multi-tenant | `core/utils/client-scope.utils.ts` + 8 servicios (ahora 403 / sin datos) |
| 8 | `GET /recurring`, `GET /assignments` y `/assignments/all` no filtraban por cliente | Fuga multi-tenant | `recurring.*`, `assignment.*` |
| 9 | `GET /recurring/guard/:guardId` no validaba que el guardia fuera de la empresa del solicitante | Fuga multi-tenant | `recurring/recurring.service.ts` |
| 10 | `POST /rounds/start` documentaba **201** pero respondía **200** | Contrato de status incorrecto | `swagger.yaml` |
| 11 | `GET /rounds/:id/share` de una ronda inexistente respondía **500** (lanzaba `Error` plano) | Status incorrecto | `rounds/round.service.ts` (ahora `AppError` 404) |
| 12 | Errores Prisma **P2025** (registro inexistente) se mapeaban a **400** con el mensaje crudo de la BD | Status incorrecto + fuga de internals | `core/middlewares/error.middleware.ts` (P2025→404, P2002→409) |
| 13 | `POST /uploads` con mime no permitido respondía **500** (multer lanzaba un `Error` plano) | Status incorrecto | `core/middlewares/multer.middleware.ts` (415) + mapeo `MulterError` (413/400) |

### Fugas de contrato de auth (corregidas)

- `src/core/middlewares/token-validator.middleware.ts` era un **middleware de auth duplicado** usado sólo por `home` y `dashboard`. Devolvía errores **fuera del sobre `TResult`** (`{msg}`), filtraba el objeto de error crudo y **no comprobaba `active`/`softDelete`** (un usuario desactivado seguía entrando al dashboard).
- Se unificó en el middleware canónico (`common/middlewares/auth.middleware.ts`, usado por los otros 24 módulos) y se eliminó el archivo. El chequeo de turno que hacía era redundante: el login ya valida el horario contra la **BD** (`user.controller.ts`).
- 16 archivos de test dejaron de mockear el módulo eliminado.

---

## 2. Documentación (swagger + referencia para LLMs)

- **19 endpoints existían en código y no estaban documentados**; ahora sí (se agregaron con tags, params, bodies y respuestas `TResult` tipadas), incluyendo 5 de dashboard con schemas nuevos (`DashboardOverview`, `ActiveGuard`, `PendingCounts`, `ActivityItem`, `PanicAlertListItem`, `IncidentReport`).
- **2 endpoints documentados que NO existían** en el código:
  - `POST /locations/print-bulk-qr` → el real es `POST /locations/print-qrs` (se eliminó el fantasma; `react_llm_reference.txt` ya no lo propaga, así que WEB/APP no generarán un 404).
  - `GET /locations/{id}` → no existe (se eliminó).
- **20 respuestas con `$ref` incorrecto** corregidas (p. ej. `GET /kardex` decía `TResultDatatableSchedule`, `GET /incidents/pending-count` decía `TResultListRound`). Se agregaron `TResultCount`, `TResultGuardGeneralStats`.
- Verificación: `165 == 165`, **0 drift**, **0 `$ref` roto**, y `yamljs` carga el archivo (lo usa `src/index.ts`).

---

## 3. Cobertura de tests por endpoint

- Antes: **126/165** endpoints con llamada directa en tests.
- Ahora: **165/165**.
- 165 tests nuevos repartidos en: dashboard (15), kardex (12), incidents (10), maintenance (10), locations (17), users (5 describe), zones (7), clients (7), shift-plans (8), recurring (8), assignments (6), rounds (8), reports (5), sync (6), settings (3), guard-logs, uniform-checks, uploads (nuevo archivo) e index (nuevo archivo).
- Los tests son de integración real contra Postgres (`checkapp_test`), con limpieza en `afterAll`, descripciones en español y aserciones sobre el sobre `TResult` + efecto en BD.

---

## 3.b Cola offline (blindaje dedicado)

Contrato garantizado en `POST /sync` y verificado en
`test/modules/sync/sync.queue.test.ts` (16 escenarios) y
`APP/__tests__/syncQueue.test.ts` (9 escenarios):

| Garantía | Antes | Ahora |
|---|---|---|
| Atomicidad | Sí | Sí (nada se aplica a medias) |
| Idempotencia (reenvío) | Sí | Sí + baja repetida no falla |
| **Diagnóstico de un registro irrecuperable** | ❌ error opaco que **bloqueaba la cola entera para siempre** | ✅ `data.rejected[]` con `{table,id,action,reason}` |
| **Tablas no permitidas** | ❌ se descartaban en silencio con 200 (pérdida de datos) | ✅ `data.ignoredTables` + 400 |
| **Borrado offline surte efecto** | ❌ baja lógica sin filtro en los listados → seguía apareciendo | ✅ filtros `deletedAt` + baja lógica consistente |
| **Borrado se propaga a otros dispositivos** | ❌ borrado físico = sin lápida | ✅ `deletedAt` llega en `changes.deleted` del pull |
| **Id repetido en `deleted`** | ❌ rechazo falso (bloqueo permanente) | ✅ deduplicado |
| **Push bloqueado por versión** | ❌ la cola quedaba atrapada hasta actualizar la APP | ✅ el gate sólo aplica al pull |
| **Media incremental (APP)** | ❌ se persistía al final del reporte → se re-subía | ✅ se persiste por archivo |
| **Reintento automático (APP)** | ❌ sólo botón manual | ✅ 3 intentos con backoff; los rechazos de datos no se reintentan |
| **Rechazos guardados (APP)** | ❌ se perdían | ✅ `sync_rejected_records` con motivo + aviso al usuario |

Endpoints/tablas afectadas por el cambio a baja lógica (con filtro `deletedAt` en
sus lecturas): `kardex`, `incidents`, `maintenance` (y `rounds`, que ya lo hacía).
Los borrados **online** de esos módulos también pasaron de físicos a lógicos: un
borrado físico no dejaba "lápida" y el registro quedaba vivo para siempre en los
dispositivos.

---

## 4. Aislamiento de pruebas (importante)

`.env.test` ahora **neutraliza los servicios externos**, porque el proceso Jest cargaba `.env` (producción):

```
AWS_BUCKET_NAME=checkapp-test-bucket   # bucket ficticio
AWS_ACCESS_KEY_ID=                     # vacías: ninguna llamada real puede autenticarse
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-2
ABLY_API_KEY=
RESEND_API_KEY=
```

Antes, un test que ejercitara el borrado de media podía **borrar objetos reales del bucket `cfsp-s3-bucket-prod`**.

---

## 5. Deuda consciente que queda (no bloquea, decidida)

| Punto | Detalle |
|---|---|
| `any` residual (9) | Todos son `z.record(z.string(), z.any())` (patrón exigido por el skill) o aparecen dentro de comentarios. No hay `any` real en lógica. |
| **Rate limiting desactivado** | `src/index.ts` tiene `// limiter,` comentado: **no hay límite de peticiones en producción** (incluido `POST /users/login`). Se dejó así a propósito en esta pasada porque activarlo globalmente (100 req/15 min) rompería la suite. Recomendado: aplicarlo sólo a rutas de auth y excluir `NODE_ENV=test`. |
| `process.env` directo | ~20 usos fuera de `env.config.ts` (mayoría `NODE_ENV`, que es idiomático). Quedan AWS/SYSTEM_URL en `storage.service`, controladores de media y `emailSender`. |
| `GET /kardex` | El rango de fechas sólo aplica si se envían `startDate` **y** `endDate`. |
| Endpoints sin 404 | Varios endpoints "detalle" devuelven `200` con `data: null` / `[]` en lugar de 404 (`/recurring/:id`, `/recurring/guard/:guardId`, `/assignments?id=`). Documentado en los tests. |
| Rutas inexistentes | Responden 404 HTML sin el sobre `TResult` (no hay middleware `notFound`). |
| `env.APP_SECRET \|\| 'secret'` | El JWT usa `getConfig("APP_SECRET")`, que **lanza** si falta (fail-closed), así que no es explotable; pero el fallback `'secret'` de `env.config.ts` es una trampa latente si alguien lo usa. |
| Aislamiento multi-tenant | Se cerraron dashboard, home, incidents, maintenance, panic, users, rounds, attendance, recurring y assignments. Una auditoría exhaustiva módulo por módulo sigue siendo recomendable (los módulos nuevos ya usan `resolveClientScope`). |

---

## 6. Cómo verificar todo

```bash
colima start                 # daemon Docker arriba
docker start checkapp-pg     # contenedor con checkapp_test (puerto 55432)
cd API
npx tsc --noEmit             # limpio
npx jest --watchman=false    # 46 suites / 451 tests verdes
node scripts/autodoc_prisma.js
```

Si Colima o el contenedor están apagados, Jest falla con
`P1001: Can't reach database server at localhost:55432`.

⚠️ **NUNCA ejecutes dos `jest` a la vez sobre este repo.** `globalSetup` hace
`prisma migrate reset` sobre `checkapp_test`: dos procesos concurrentes se
borran el esquema mutuamente y producen fallos fantasma (404 en rutas
existentes, conteos que no cuadran, `Parse Error: Expected HTTP/, RTSP/ or ICE/`).
Verificado: 3 corridas **en serie** dan 451/451; las corridas que solaparon con
otro proceso dieron fallos espurios. Tampoco conviene lanzar la suite mientras
corren `tsc`/builds pesados en paralelo.

Estabilidad medida: **3 corridas completas consecutivas en verde** + 3 corridas
de los archivos antes inestables (kardex/sync/zones/incidents-flow) = 75/75 cada una.

Verificación de la APP (flujo offline):

```bash
cd APP
npx jest --watchman=false __tests__/syncQueue.test.ts   # 9 tests
npx jest --watchman=false                               # 17 tests verdes
```

`__tests__/App.test.tsx` falla por módulos nativos de React Native
(`RNGestureHandlerModule`), un problema **preexistente y ajeno** al flujo offline.

