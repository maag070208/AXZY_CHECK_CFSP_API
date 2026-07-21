import * as Ably from "ably";
import { logger } from "./logger";

const ABLY_KEY =
  process.env.ABLY_API_KEY ||
  "_iYGPA.fJVkAw:ix6oVHub7TpqllbX6JMdmfJgDoqKKEIoZ5wJNRo6Zlc";

let ablyRest: Ably.Rest | null = null;

export const getAbly = (): Ably.Rest => {
  if (!ablyRest) {
    ablyRest = new Ably.Rest({ key: ABLY_KEY });
  }
  return ablyRest;
};

/**
 * Publica un evento de actividad en el canal 'global' de Ably.
 * La web escucha este canal y refresca el dashboard en tiempo real.
 *
 * @param type   tipo de actividad: 'incident' | 'maintenance' | 'discipline' | 'guard_status' | 'panic_resolved'
 * @param action 'created' | 'updated' | 'resolved' | 'login' | 'logout'
 * @param payload datos del evento
 */
export const publishActivity = async (
  type: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<void> => {
  try {
    const ably = getAbly();
    const channel = ably.channels.get("global");
    await channel.publish("activity", {
      type,
      action,
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch (e) {
    logger.error(`[Ably] Error publicando actividad ${type}/${action}:`, e);
  }
};

/**
 * Publica en el canal dedicado del cliente. Usado para eventos
 * que solo le importan a un cliente específico (ej. panic alerts).
 */
export const publishToClient = async (
  clientId: string | null,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> => {
  try {
    const ably = getAbly();
    const channelName = clientId ? `panic.${clientId}` : "panic.global";
    const channel = ably.channels.get(channelName);
    await channel.publish(event, {
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch (e) {
    logger.error(`[Ably] Error publicando a cliente ${clientId}:`, e);
  }
};
