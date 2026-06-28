import { prismaClient } from "@src/core/config/database";
import { logger } from "@src/core/utils/logger";
import { now } from "@src/core/utils/date-time.utils";
import { ROLE_ADMIN, ROLE_SHIFT } from "@src/core/config/constants";

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

export interface IPanicAlertInput {
  guardId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  source?: "volume_button" | "manual";
  notes?: string;
}

export interface IPanicAlertResult {
  id: string;
  supervisorsNotified: number;
  ablyChannel: string;
  createdAt: Date;
}

/**
 * Crea una alerta de pánico:
 * 1. Persiste como Incident con título [EMERGENCIA] (aparece en el listado
 *    de pendientes normal pero marcado).
 * 2. Envía FCM push URGENTE a todos los admins y supervisores del
 *    mismo clientId del guardia (canal crítico, prioridad high).
 * 3. Publica en Ably en el canal "panic.{clientId}" para que el dashboard
 *    web se actualice en tiempo real con un overlay rojo.
 * 4. Retorna inmediatamente al guardia (fire-and-forget el resto).
 */
export const createPanicAlert = async (
  input: IPanicAlertInput,
): Promise<IPanicAlertResult> => {
  // 1) Resolver clientId del guardia si no viene en el payload
  const guard = await prismaClient.user.findUnique({
    where: { id: input.guardId },
    select: {
      id: true,
      name: true,
      lastName: true,
      clientId: true,
    },
  });

  if (!guard) {
    throw new Error("Guardia no encontrado");
  }

  // 2) Persistir como Incident
  const incident = await prismaClient.incident.create({
    data: {
      guardId: guard.id,
      title: "[EMERGENCIA] Alerta de pánico",
      description:
        input.notes ??
        `Alerta de pánico disparada desde ${
          input.source === "volume_button"
            ? "botón de volumen"
            : "acción manual"
        }. El guardia requiere apoyo inmediato.`,
      latitude: input.latitude,
      longitude: input.longitude,
      clientId: guard.clientId,
      status: "PENDING",
    },
  });

  const ablyChannel = `panic.${guard.clientId ?? "global"}`;

  // 3) Fire-and-forget: FCM + Ably
  setImmediate(async () => {
    try {
      // 3a) FCM push a admins y supervisores del mismo clientId
      const fcm = getFirebase();
      if (fcm) {
        const supervisors = await prismaClient.user.findMany({
          where: {
            active: true,
            softDelete: false,
            fcmToken: { not: null },
            OR: [
              { role: { value: ROLE_ADMIN } },
              { role: { value: ROLE_SHIFT } },
            ],
            ...(guard.clientId
              ? { clientId: guard.clientId }
              : {}),
          },
          select: { fcmToken: true, id: true },
        });

        const tokens = supervisors
          .map((u) => u.fcmToken)
          .filter(Boolean) as string[];

        if (tokens.length > 0) {
          const guardName = `${guard.name} ${guard.lastName ?? ""}`.trim();
          const lat = input.latitude;
          const lng = input.longitude;
          const message =
            lat != null && lng != null
              ? `${guardName} requiere apoyo inmediato. Ubicación: https://www.google.com/maps?q=${lat},${lng}`
              : `${guardName} requiere apoyo inmediato.`;

          await fcm.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: "🚨 EMERGENCIA",
              body: message,
            },
            data: {
              type: "panic",
              incidentId: incident.id,
              guardId: guard.id,
              guardName,
              latitude: String(input.latitude ?? ""),
              longitude: String(input.longitude ?? ""),
              accuracy: String(input.accuracy ?? ""),
              source: input.source ?? "volume_button",
              timestamp: now().toISOString(),
              channel: ablyChannel,
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

          // 3b) Persistir en NotificationLog para que aparezca en el feed
          for (const sup of supervisors) {
            try {
              await prismaClient.notificationLog.create({
                data: {
                  userId: sup.id,
                  title: "🚨 EMERGENCIA",
                  message,
                  type: "panic",
                },
              });
            } catch (e) {
              logger.warn("Error guardando notificationLog para pánico:", e);
            }
          }

          logger.info(
            `[Panic] Alerta creada ${incident.id} - notificada a ${tokens.length} supervisores`,
          );
        } else {
          logger.warn(
            `[Panic] Alerta creada ${incident.id} - sin supervisores con FCM token`,
          );
        }
      }

      // 3c) Ably: tiempo real al dashboard
      try {
        const ably = getAbly();
        const channel = ably.channels.get(ablyChannel);
        await channel.publish("panic", {
          incidentId: incident.id,
          guardId: guard.id,
          guardName: `${guard.name} ${guard.lastName ?? ""}`.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy,
          source: input.source,
          timestamp: now().toISOString(),
        });
      } catch (e) {
        logger.error("[Panic] Error publicando en Ably:", e);
      }
    } catch (err) {
      logger.error("[Panic] Error en fire-and-forget:", err);
    }
  });

  return {
    id: incident.id,
    supervisorsNotified: 0,
    ablyChannel,
    createdAt: incident.createdAt,
  };
};

export const getPanicAlertById = async (id: string) => {
  return prismaClient.incident.findUnique({
    where: { id },
    include: {
      guard: { select: { id: true, name: true, lastName: true } },
    },
  });
};
