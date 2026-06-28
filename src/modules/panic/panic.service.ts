import { prismaClient } from "@src/core/config/database";
import { logger } from "@src/core/utils/logger";
import { now } from "@src/core/utils/date-time.utils";
import { ROLE_GUARD, ROLE_CLIENT } from "@src/core/config/constants";
import {
  IPanicAlert,
  IPanicAlertCreate,
  IPanicAlertResolve,
  IPaginatedPanicAlerts,
  PanicAlertStatus,
} from "./panic.dto";
import { ITDataTableFetchParams } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";

import * as Ably from "ably";

const ABLY_KEY =
  process.env.ABLY_API_KEY ||
  "_iYGPA.fJVkAw:ix6oVHub7TpqllbX6JMdmfJgDoqKKEIoZ5wJNRo6Zlc";

let ablyRest: Ably.Rest | null = null;
const getAbly = (): Ably.Rest => {
  if (!ablyRest) {
    ablyRest = new Ably.Rest({ key: ABLY_KEY });
  }
  return ablyRest;
};

let firebaseApp: any = null;
const getFirebase = () => {
  if (!firebaseApp) {
    try {
      const admin = require("firebase-admin");
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : require("@src/../axzyfansalcheck-firebase-adminsdk-fbsvc-a3b898be27.json");
      firebaseApp = admin.apps.length
        ? admin.apps[0]
        : admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
    } catch (e) {
      console.warn("[PanicFCM] Firebase Admin no configurado:", e);
    }
  }
  return firebaseApp;
};

const PANIC_INCLUDE = {
  guard: { select: { id: true, name: true, lastName: true, username: true } },
  client: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true, lastName: true } },
};

const toDto = (a: any): IPanicAlert => ({
  id: a.id,
  guardId: a.guardId,
  guard: a.guard,
  clientId: a.clientId,
  client: a.client,
  source: a.source,
  triggerLatitude: a.triggerLatitude,
  triggerLongitude: a.triggerLongitude,
  triggerAccuracy: a.triggerAccuracy,
  message: a.message,
  status: a.status,
  resolutionComment: a.resolutionComment,
  resolvedById: a.resolvedById,
  resolvedBy: a.resolvedBy,
  resolvedAt: a.resolvedAt?.toISOString?.() ?? null,
  createdAt: a.createdAt.toISOString(),
});

/**
 * Construye el where clause base filtrado por clientId cuando
 * el usuario es RESDN/cliente. ADMIN ve todo.
 */
const buildClientFilter = (user: any) => {
  if (user?.role === ROLE_CLIENT && user.clientId) {
    return { clientId: user.clientId };
  }
  return {};
};

/**
 * Crea una alerta de pánico como entidad propia.
 * 1) Persiste en tabla PanicAlert
 * 2) Fire-and-forget: FCM a todos los guardias del mismo clientId
 * 3) Publica en Ably (canal global + canal dedicado del cliente)
 */
export const createPanicAlert = async (
  input: IPanicAlertCreate,
): Promise<IPanicAlert> => {
  const guard = await prismaClient.user.findUnique({
    where: { id: input.guardId },
    select: { id: true, name: true, lastName: true, clientId: true },
  });

  if (!guard) {
    throw new Error("Guardia no encontrado");
  }

  const clientId = input.clientId ?? guard.clientId ?? null;

  const alert = await prismaClient.panicAlert.create({
    data: {
      guardId: guard.id,
      clientId,
      source: input.source ?? "volume_button",
      triggerLatitude: input.triggerLatitude,
      triggerLongitude: input.triggerLongitude,
      triggerAccuracy: input.triggerAccuracy,
      message: input.message,
      status: "PENDING",
    },
    include: PANIC_INCLUDE,
  });

  const dto = toDto(alert);
  const guardName = `${guard.name} ${guard.lastName ?? ""}`.trim();
  const lat = input.triggerLatitude;
  const lng = input.triggerLongitude;
  const panicMessage =
    lat != null && lng != null
      ? `${guardName} requiere apoyo inmediato. Ubicación: https://www.google.com/maps?q=${lat},${lng}`
      : `${guardName} requiere apoyo inmediato.`;

  // Fire-and-forget
  setImmediate(async () => {
    try {
      const fcm = getFirebase();
      if (fcm) {
        const peerGuards = await prismaClient.user.findMany({
          where: {
            active: true,
            softDelete: false,
            fcmToken: { not: null },
            id: { not: guard.id },
            role: { name: ROLE_GUARD },
            ...(clientId ? { clientId } : {}),
          },
          select: { fcmToken: true, id: true },
        });

        const tokens = peerGuards
          .map((u) => u.fcmToken)
          .filter(Boolean) as string[];

        if (tokens.length > 0) {
          await fcm.messaging().sendEachForMulticast({
            tokens,
            notification: { title: "🚨 EMERGENCIA", body: panicMessage },
            data: {
              type: "panic",
              alertId: dto.id,
              guardId: guard.id,
              guardName,
              clientId: clientId ?? "",
              latitude: String(input.triggerLatitude ?? ""),
              longitude: String(input.triggerLongitude ?? ""),
              accuracy: String(input.triggerAccuracy ?? ""),
              timestamp: dto.createdAt,
              channel: "global",
              priority: "CRITICAL",
              click_action: "OPEN_PANIC",
            },
            android: {
              priority: "high",
              notification: {
                channelId: "fansal-panic",
                color: "#DC2626",
                sound: "default",
                vibrate: [0, 200, 100, 200, 100, 200],
              },
            },
            apns: {
              payload: {
                aps: {
                  contentAvailable: true,
                  sound: "default",
                  badge: 1,
                  "interruption-level": "critical",
                },
              },
            },
          });

          for (const peer of peerGuards) {
            try {
              await prismaClient.notificationLog.create({
                data: {
                  userId: peer.id,
                  title: "🚨 EMERGENCIA",
                  message: panicMessage,
                  type: "panic",
                },
              });
            } catch {}
          }
        }
      }

      try {
        const ably = getAbly();

        const globalChannel = ably.channels.get("global");
        await globalChannel.publish("notification", {
          title: "🚨 EMERGENCIA",
          message: panicMessage,
          type: "error",
          timestamp: dto.createdAt,
          persistent: true,
          panic: true,
          alertId: dto.id,
          incidentId: dto.id, // compat con consumidores legacy
          guardId: guard.id,
          guardName,
          clientId,
          latitude: input.triggerLatitude,
          longitude: input.triggerLongitude,
          accuracy: input.triggerAccuracy,
        });

        const dedicatedChannelName = clientId
          ? `panic.${clientId}`
          : "panic.global";
        const dedicatedChannel = ably.channels.get(dedicatedChannelName);
        await dedicatedChannel.publish("panic", {
          alertId: dto.id,
          incidentId: dto.id, // compat
          guardId: guard.id,
          guardName,
          clientId,
          latitude: input.triggerLatitude,
          longitude: input.triggerLongitude,
          accuracy: input.triggerAccuracy,
          source: input.source ?? "volume_button",
          timestamp: dto.createdAt,
        });
      } catch (e) {
        logger.error("[Panic] Error publicando en Ably:", e);
      }
    } catch (err) {
      logger.error("[Panic] Error en fire-and-forget:", err);
    }
  });

  return dto;
};

/**
 * Lista paginada con filtros (server-side). Filtra por scope:
 * - RESDN: solo su clientId
 * - ADMIN/SHIFT/LIDER: todos
 */
export const getDataTablePanicAlerts = async (
  params: ITDataTableFetchParams,
  user: any,
): Promise<IPaginatedPanicAlerts> => {
  const prismaParams = getPrismaPaginationParams(params);
  const clientFilter = buildClientFilter(user);

  const filters: any = {
    ...prismaParams.where,
    ...clientFilter,
  };

  // Filtros específicos de PanicAlerts
  if (params.filters?.status) filters.status = params.filters.status;
  if (params.filters?.guardId) filters.guardId = params.filters.guardId;
  if (params.filters?.clientId) filters.clientId = params.filters.clientId;
  if (params.filters?.search) {
    const q = String(params.filters.search).trim();
    if (q.length > 0) {
      filters.OR = [
        { message: { contains: q, mode: "insensitive" } },
        { guard: { name: { contains: q, mode: "insensitive" } } },
        { guard: { lastName: { contains: q, mode: "insensitive" } } },
        { guard: { username: { contains: q, mode: "insensitive" } } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ];
    }
  }

  const [rows, total] = await Promise.all([
    prismaClient.panicAlert.findMany({
      where: filters,
      include: PANIC_INCLUDE,
      orderBy: prismaParams.orderBy || { createdAt: "desc" },
    }),
    prismaClient.panicAlert.count({ where: filters }),
  ]);

  return {
    rows: rows.map(toDto),
    total,
  };
};

export const getPanicAlertById = async (
  id: string,
  user: any,
): Promise<IPanicAlert | null> => {
  const alert = await prismaClient.panicAlert.findFirst({
    where: {
      id,
      ...buildClientFilter(user),
    },
    include: PANIC_INCLUDE,
  });
  return alert ? toDto(alert) : null;
};

export const resolvePanicAlert = async (
  id: string,
  input: IPanicAlertResolve,
  user: any,
): Promise<IPanicAlert> => {
  // Validar que la alerta existe y que el usuario tiene scope
  const existing = await prismaClient.panicAlert.findFirst({
    where: { id, ...buildClientFilter(user) },
  });
  if (!existing) {
    throw new Error("Alerta de pánico no encontrada");
  }

  const updated = await prismaClient.panicAlert.update({
    where: { id },
    data: {
      status: input.status ?? "RESOLVED",
      resolutionComment: input.resolutionComment,
      resolvedById: user?.id ?? null,
      resolvedAt: now(),
    },
    include: PANIC_INCLUDE,
  });

  return toDto(updated);
};

export const getRecentPanicAlerts = async (
  user: any,
  limit: number = 10,
): Promise<IPanicAlert[]> => {
  const alerts = await prismaClient.panicAlert.findMany({
    where: { deletedAt: null, ...buildClientFilter(user) },
    include: PANIC_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  return alerts.map(toDto);
};

export const countPendingPanicAlerts = async (
  user: any,
): Promise<number> => {
  return prismaClient.panicAlert.count({
    where: { status: "PENDING", ...buildClientFilter(user) },
  });
};
