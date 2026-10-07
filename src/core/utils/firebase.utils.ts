import type { Message, MulticastMessage } from "firebase-admin/messaging";
import { env } from "@src/core/config/env.config";
import { logger } from "./logger";

/**
 * Interfaz mínima del módulo `firebase-admin` cargado de forma perezosa.
 * Se declara a mano para no importar firebase-admin en el arranque (es pesado y
 * opcional) y para no recurrir a `any`.
 */
export interface IFirebaseMessaging {
  send(m: Message): Promise<string>;
  sendEachForMulticast(m: MulticastMessage): Promise<unknown>;
}

export interface IFirebaseApp {
  messaging(): IFirebaseMessaging;
}

interface IFirebaseAdminModule {
  apps: unknown[];
  initializeApp(opts: Record<string, unknown>): unknown;
  credential: { cert(serviceAccount: unknown): unknown };
}

let firebaseApp: IFirebaseApp | null = null;

/**
 * Devuelve la app de Firebase Admin si está configurada; `null` en caso contrario.
 * La carga es perezosa y best-effort: si no hay credenciales, se registra un
 * warning y se devuelve `null`.
 */
export const getFirebaseApp = (): IFirebaseApp | null => {
  // En pruebas no se inicializa Firebase: el service account existe en disco y
  // hacerlo dispara llamadas reales de red (flakiness / "socket hang up").
  if (process.env.NODE_ENV === "test") return null;

  if (!firebaseApp) {
    try {
      // tslint:disable-next-line
      const admin = require("firebase-admin") as IFirebaseAdminModule;
      const serviceAccount = env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
        : require("@src/../axzyfansalcheck-firebase-adminsdk-fbsvc-a3b898be27.json");
      firebaseApp = (admin.apps.length
        ? admin.apps[0]
        : admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          })) as IFirebaseApp;
    } catch (e) {
      logger.warn("[FCM] Firebase Admin no configurado:", e);
    }
  }
  return firebaseApp;
};
