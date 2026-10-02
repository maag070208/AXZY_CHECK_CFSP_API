export const ROLE_GUARD = "GUARD";
export const ROLE_SHIFT = "SHIFT";
export const ROLE_MAINTENANCE = "MAINT";
export const ROLE_ADMIN = "ADMIN";
export const ROLE_CLIENT = "RESDN";
export const ROLE_LEADER = "LIDER";

export const OPERATIONAL_ROLES = [ROLE_GUARD, ROLE_SHIFT, ROLE_MAINTENANCE];

// Round Status
export const ROUND_STATUS_IN_PROGRESS = "IN_PROGRESS";
export const ROUND_STATUS_COMPLETED = "COMPLETED";

// Maintenance Status
export const MAINTENANCE_STATUS_PENDING = "PENDING";
export const MAINTENANCE_STATUS_ATTENDED = "ATTENDED";

// Incident Status
export const INCIDENT_STATUS_PENDING = "PENDING";
export const INCIDENT_STATUS_ATTENDED = "ATTENDED";

// Assignment Status
export const ASSIGNMENT_STATUS_PENDING = "PENDING";
export const ASSIGNMENT_STATUS_CHECKING = "CHECKING";
export const ASSIGNMENT_STATUS_UNDER_REVIEW = "UNDER_REVIEW";
export const ASSIGNMENT_STATUS_REVIEWED = "REVIEWED";
export const ASSIGNMENT_STATUS_ANOMALY = "ANOMALY";

// Scan Type
export const SCAN_TYPE_ASSIGNMENT = "ASSIGNMENT";
export const SCAN_TYPE_RECURRING = "RECURRING";
export const SCAN_TYPE_FREE = "FREE";

// External Keys
export const GOOGLE_MAPS_KEY = "AIzaSyBEcey4scuaufZ6TD4oOZZKjO-CIOVXa8w";

// Category Types
export const CATEGORY_TYPE_INCIDENT = "INCIDENT";
export const CATEGORY_TYPE_MAINTENANCE = "MAINTENANCE";

// PDF Colors
export const PDF_COLOR_PRIMARY = '#1e293b';
export const PDF_COLOR_SUCCESS = '#10b981';
export const PDF_COLOR_BLUE = '#3b82f6';
export const PDF_COLOR_PURPLE = '#a855f7';
export const PDF_COLOR_ORANGE = '#f97316';
export const PDF_COLOR_GRAY = '#64748b';
export const PDF_COLOR_BORDER = '#f1f5f9';
export const PDF_COLOR_CARD_BG = '#ffffff';
export const PDF_COLOR_WHITE = '#FFFFFF';
export const PDF_COLOR_BLACK = '#000000';
// Timeline Event Types
export const TIMELINE_EVENT_START = "START";
export const TIMELINE_EVENT_END = "END";
export const TIMELINE_EVENT_SCAN = "SCAN";
export const TIMELINE_EVENT_INCIDENT = "INCIDENT";

// Security
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const RATE_LIMIT_MAX_REQUESTS = 100; // Máximo 100 req por IP

/**
 * Opciones para transacciones interactivas que ejecutan bastante trabajo
 * (cascadas de borrado, sync, altas con escrituras anidadas). El timeout por
 * defecto de Prisma es de 5 s, insuficiente bajo carga o con muchos registros.
 */
export const PRISMA_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
};

// Versión de la API / App
export const API_VERSION = "1.0.0";

// Zona horaria operativa (horarios de turno, agenda y fechas de turno)
export const DEFAULT_TIMEZONE = "America/Tijuana";

// ── Entregas de turno / Uniformes / Programación ──

/** Roles que pueden registrar entregas de turno y revisiones de uniforme. */
export const SUPERVISION_ROLES = [ROLE_ADMIN, ROLE_LEADER, ROLE_SHIFT];
/** Roles que pueden consultar entregas, uniformes y la agenda. */
export const SUPERVISION_READ_ROLES = [...SUPERVISION_ROLES, ROLE_CLIENT];
/** Roles que pueden configurar la programación de turnos. */
export const PLANNING_ADMIN_ROLES = [ROLE_ADMIN, ROLE_LEADER];

export interface IChecklistItemDefinition {
  key: string;
  label: string;
  group: string;
}

/** Equipo/insumos que se verifican al recibir un turno. */
export const SHIFT_HANDOVER_CHECKLIST: IChecklistItemDefinition[] = [
  { key: "phones", label: "Teléfonos", group: "Equipo" },
  { key: "tablet", label: "Tablet", group: "Equipo" },
  { key: "radios", label: "Radios", group: "Equipo" },
  { key: "keys", label: "Llaves", group: "Equipo" },
  { key: "logbook", label: "Bitácora", group: "Documentación" },
  { key: "consignas", label: "Consignas", group: "Documentación" },
];

/** Elementos de uniforme y aseo que se evalúan por guardia. */
export const UNIFORM_CHECKLIST: IChecklistItemDefinition[] = [
  { key: "pantalon", label: "Pantalón", group: "Uniforme" },
  { key: "camisa", label: "Camisa", group: "Uniforme" },
  { key: "botas", label: "Botas", group: "Uniforme" },
  { key: "cinturon", label: "Cinturón", group: "Uniforme" },
  { key: "gorra", label: "Gorra (recorrido)", group: "Uniforme" },
  { key: "gafete", label: "Gafete / identificación", group: "Uniforme" },
  { key: "pluma", label: "Pluma", group: "Uniforme" },
  { key: "unas", label: "Uñas", group: "Aseo" },
  { key: "afeitado", label: "Afeitado", group: "Aseo" },
  { key: "peinado", label: "Peinado", group: "Aseo" },
  { key: "pulcritud", label: "Pulcritud / desodorante", group: "Aseo" },
];

/** Porcentaje mínimo para considerar que un guardia "cumple" con el uniforme. */
export const UNIFORM_MIN_COMPLIANT_SCORE = 90;

/** Tolerancia por defecto (min) tras el inicio del turno. */
export const SHIFT_PLAN_DEFAULT_TOLERANCE_MINUTES = 30;

/** Estados calculados de un compromiso de la agenda. */
export const AGENDA_STATUS = {
  UPCOMING: "UPCOMING",
  IN_WINDOW: "IN_WINDOW",
  OVERDUE: "OVERDUE",
  MISSED: "MISSED",
  DONE: "DONE",
} as const;
export type AgendaStatus = (typeof AGENDA_STATUS)[keyof typeof AGENDA_STATUS];

export const AGENDA_ITEM_TYPE = {
  HANDOVER: "HANDOVER",
  UNIFORM: "UNIFORM",
} as const;
export type AgendaItemType = (typeof AGENDA_ITEM_TYPE)[keyof typeof AGENDA_ITEM_TYPE];

// ── Dashboard en vivo ──

/** Minutos sin escanear para marcar una ronda como estancada. */
export const DASHBOARD_STALE_ROUND_MINUTES = 30;
/** Horas abiertas para considerar una ronda abandonada (no se cerró). */
export const DASHBOARD_ABANDONED_ROUND_HOURS = 12;
/** Días máximos hacia atrás para leer escaneos de rondas activas. */
export const DASHBOARD_MAX_KARDEX_LOOKBACK_DAYS = 7;
