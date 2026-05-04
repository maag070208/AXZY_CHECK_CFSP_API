import { prismaClient } from "@src/core/config/database";
import { TResult } from "@src/core/dto/TResult";
import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import axios from "axios";
import {
  GOOGLE_MAPS_KEY,
  ROLE_CLIENT,
  ROUND_STATUS_COMPLETED,
  ROUND_STATUS_IN_PROGRESS,
  PDF_COLOR_PRIMARY,
  PDF_COLOR_SUCCESS,
  PDF_COLOR_BLUE,
  PDF_COLOR_PURPLE,
  PDF_COLOR_ORANGE,
  PDF_COLOR_GRAY,
  PDF_COLOR_BORDER,
  PDF_COLOR_CARD_BG,
} from "@src/core/config/constants";

const prisma = prismaClient;

export const getDataTableRounds = async (
  params: ITDataTableFetchParams,
  user?: any,
): Promise<ITDataTableResponse<any>> => {
  const customFilters = params.filters || {};
  const cleanFilters: any = {};
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (key !== "refreshKey" && key !== "date") {
        if (key === "guard") {
          cleanFilters["guardId"] = value;
        } else if (key === "client") {
          cleanFilters["clientId"] = value;
        } else if (key === "search") {
          cleanFilters.guard = {
            OR: [
              { name: { contains: String(value), mode: "insensitive" } },
              { lastName: { contains: String(value), mode: "insensitive" } },
              { username: { contains: String(value), mode: "insensitive" } },
            ],
          };
        } else {
          cleanFilters[key] = value;
        }
      }
    }
  }

  const prismaParams = getPrismaPaginationParams({
    ...params,
    filters: cleanFilters,
    sort: params.sort || { key: "startTime", direction: "desc" },
  });

  if (customFilters.date) {
    const dateParams = Array.isArray(customFilters.date)
      ? customFilters.date
      : [customFilters.date, customFilters.date];
    const start = new Date(dateParams[0]);
    const end = new Date(dateParams[1] || dateParams[0]);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      prismaParams.where.startTime = { gte: start, lte: end };
    }
  }

  if (user?.role === ROLE_CLIENT && user.clientId) {
    prismaParams.where.clientId = user.clientId;
  }

  const [rows, total] = await Promise.all([
    prisma.round.findMany({
      ...prismaParams,
      include: {
        guard: { include: { client: true } },
        client: true,
        recurringConfiguration: {
          include: { client: true },
        },
      },
    }),
    prisma.round.count({ where: prismaParams.where }),
  ]);

  return { rows, total };
};

export const startRound = async (
  guardId: string,
  clientId?: string,
  recurringConfigurationId?: string,
): Promise<TResult<any>> => {
  try {
    let targetClientId = clientId;

    if (!targetClientId && recurringConfigurationId) {
      const config = await prisma.recurringConfiguration.findUnique({
        where: { id: recurringConfigurationId },
        select: { clientId: true },
      });
      if (config?.clientId) targetClientId = config.clientId;
    }

    const round = await prisma.round.create({
      data: {
        guardId,
        clientId: targetClientId,
        recurringConfigurationId,
        status: ROUND_STATUS_IN_PROGRESS,
        startTime: new Date(),
      },
    });
    return { success: true, data: round, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const endRound = async (id: string): Promise<TResult<any>> => {
  try {
    const round = await prisma.round.update({
      where: { id },
      data: { status: ROUND_STATUS_COMPLETED, endTime: new Date() },
    });
    return { success: true, data: round, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const getCurrentRound = async (
  guardId: string,
): Promise<TResult<any>> => {
  try {
    const round = await prisma.round.findFirst({
      where: { guardId, status: ROUND_STATUS_IN_PROGRESS },
      include: {
        recurringConfiguration: {
          include: {
            recurringLocations: {
              include: { location: { include: { zone: true } } },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (round) {
      const kardex = await prisma.kardex.findMany({
        where: {
          userId: guardId,
          timestamp: { gte: round.startTime },
        },
        include: { location: true },
      });
      (round as any).kardex = kardex;
    }

    return { success: true, data: round, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const getRounds = async (
  date?: string,
  guardId?: string,
  user?: any,
): Promise<TResult<any>> => {
  try {
    const where: any = {};
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.startTime = { gte: start, lte: end };
    }
    if (guardId) where.guardId = guardId;
    if (user?.role === ROLE_CLIENT && user.clientId)
      where.clientId = user.clientId;

    const rounds = await prisma.round.findMany({
      where,
      include: { guard: true, recurringConfiguration: true, client: true },
      orderBy: { startTime: "desc" },
    });
    return { success: true, data: rounds, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export interface IRoundDetail {
  round: any;
  timeline: Array<{
    type: "START" | "END" | "SCAN" | "INCIDENT";
    timestamp: Date;
    description: string;
    data: any;
  }>;
}

export const getRoundDetail = async (
  id: string,
  user?: any,
): Promise<TResult<IRoundDetail | null>> => {
  try {
    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        guard: { include: { client: true } },
        client: { include: { locations: true } },
        recurringConfiguration: {
          include: {
            recurringLocations: {
              include: { location: true },
              orderBy: { order: "asc" },
            },
            client: true,
          },
        },
      },
    });

    if (!round)
      return { success: false, data: null, messages: ["Ronda no encontrada"] };
    if (
      user?.role === ROLE_CLIENT &&
      user.clientId &&
      round.clientId !== user.clientId
    ) {
      return {
        success: false,
        data: null,
        messages: ["No tienes permiso para ver los detalles de esta ronda."],
      };
    }

    const start = round.startTime;
    const end = round.endTime || new Date();

    const scans = await prisma.kardex.findMany({
      where: { timestamp: { gte: start, lte: end }, userId: round.guardId },
      include: { location: true, assignment: { include: { tasks: true } } },
      orderBy: { timestamp: "asc" },
    });

    const incidents = await prisma.incident.findMany({
      where: { createdAt: { gte: start, lte: end }, guardId: round.guardId },
      include: { category: true },
      orderBy: { createdAt: "asc" },
    });

    const timeline: any[] = [];
    timeline.push({
      type: "START",
      timestamp: round.startTime,
      description: "Inicio de Ronda",
      data: null,
    });
    scans.forEach((s) => {
      timeline.push({
        type: "SCAN",
        timestamp: s.timestamp,
        description: `Escaneo: ${(s as any).location?.name || "Punto desconocido"}`,
        data: s,
      });
    });
    incidents.forEach((i) => {
      timeline.push({
        type: "INCIDENT",
        timestamp: i.createdAt,
        description: `Incidente: ${(i as any).category?.name || "Sin categoría"}`,
        data: i,
      });
    });
    if (round.status === ROUND_STATUS_COMPLETED && round.endTime) {
      timeline.push({
        type: "END",
        timestamp: round.endTime,
        description: "Cierre de Ronda",
        data: null,
      });
    }
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return { success: true, data: { round, timeline }, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

const fetchImageAsBuffer = async (url: string): Promise<Buffer | null> => {
  try {
    if (url.startsWith("data:image")) {
      const base64Data = url.split(",")[1];
      return Buffer.from(base64Data, "base64");
    }
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    return null;
  }
};

export const generateRoundPDF = async (
  id: string,
  user?: any,
): Promise<Buffer> => {
  const detailRes = await getRoundDetail(id, user);
  if (!detailRes.success || !detailRes.data) {
    throw new Error(detailRes.messages?.[0] || "Ronda no encontrada");
  }

  const { round, timeline } = detailRes.data;

  const clientName =
    round.client?.name ||
    round.recurringConfiguration?.client?.name ||
    round.guard?.client?.name ||
    "Sin Cliente";

  const doc = new PDFDocument({ margin: 0, size: "LETTER", bufferPages: true });
  const buffers: any[] = [];
  doc.on("data", buffers.push.bind(buffers));

  const C_DARK = "#0f172a";
  const C_PRIMARY = "#10b981";
  const C_BLUE = "#3b82f6";
  const C_ORANGE = "#f97316";
  const C_RED = "#ef4444";
  const C_GRAY = "#64748b";
  const C_LIGHT = "#f1f5f9";
  const C_BORDER = "#e2e8f0";
  const C_WHITE = "#ffffff";

  const start = new Date(round.startTime);
  const end = round.endTime ? new Date(round.endTime) : new Date();
  const durationMs = end.getTime() - start.getTime();
  const durationStr = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;

  const scans = timeline.filter((e: any) => e.type === "SCAN");
  const expectedLocs = round.recurringConfiguration?.recurringLocations || [];

  const visitedSet = new Set<string>();
  let completedCount = 0;
  let incompleteCount = 0;

  scans.forEach((scan: any) => {
    const locId = String(scan.data?.location?.id);
    const hasMedia =
      scan.data?.media &&
      Array.isArray(scan.data.media) &&
      scan.data.media.length > 0;
    if (!visitedSet.has(locId)) {
      visitedSet.add(locId);
      if (hasMedia) completedCount++;
      else incompleteCount++;
    }
  });

  const missingLocs = expectedLocs.filter(
    (rl: any) => !visitedSet.has(String(rl.location?.id || rl.locationId)),
  );
  const missingCount = missingLocs.length;
  const totalPoints = completedCount + incompleteCount + missingCount || 1;

  const avgMs = scans.length > 0 ? durationMs / scans.length : 0;
  const avgStr = `${Math.floor(avgMs / 60000)}m ${Math.floor((avgMs % 60000) / 1000)}s`;

  // ─── Header ─────────────────────────────────────────────────────────
  doc.rect(0, 0, 612, 90).fillColor(C_DARK).fill();
  const logoPath = path.join(process.cwd(), "src/assets/logo_fansal.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 24, 18, { height: 54 });
  }
  doc
    .fillColor(C_PRIMARY)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("FANSAL", 90, 22);
  doc
    .fillColor("#94a3b8")
    .font("Helvetica")
    .fontSize(8)
    .text("Sistema de Gestión de Seguridad", 90, 44);

  doc.roundedRect(430, 22, 158, 46, 8).fillColor("#1e293b").fill();
  doc
    .fillColor(C_PRIMARY)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("REPORTE DE RONDA", 438, 30, { width: 142, align: "center" });
  doc
    .fillColor(C_WHITE)
    .font("Helvetica")
    .fontSize(7)
    .text(
      new Date(round.startTime).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      438,
      46,
      { width: 142, align: "center" },
    );
  doc
    .fillColor(round.status === "COMPLETED" ? C_PRIMARY : C_ORANGE)
    .font("Helvetica-Bold")
    .fontSize(7)
    .text(
      round.status === "COMPLETED" ? "✓ FINALIZADA" : "⏳ EN CURSO",
      438,
      58,
      { width: 142, align: "center" },
    );

  doc.rect(0, 90, 612, 60).fillColor(C_LIGHT).fill();
  doc.rect(0, 90, 4, 60).fillColor(C_PRIMARY).fill();
  const roundTitle =
    round.recurringConfiguration?.title?.toUpperCase() ||
    `RONDA #${round.id.substring(0, 8).toUpperCase()}`;
  doc
    .fillColor(C_DARK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(roundTitle, 24, 105, { width: 560 });

  const infoY = 162;
  const cols = [
    {
      label: "GUARDIA",
      value: `${round.guard.name} ${round.guard.lastName}`,
      x: 24,
    },
    { label: "CLIENTE", value: clientName, x: 220 },
    {
      label: "INICIO",
      value: new Date(round.startTime).toLocaleString("es-MX"),
      x: 380,
    },
  ];
  cols.forEach((col) => {
    doc
      .fillColor(C_GRAY)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(col.label, col.x, infoY);
    doc
      .fillColor(C_DARK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(col.value, col.x, infoY + 12, { width: 170 });
  });

  // ─── KPI Cards ───────────────────────────────────────────────────────────
  const kpiY = 220;
  const kpiW = 103;
  const kpis = [
    { label: "DURACIÓN TOTAL", value: durationStr, color: C_BLUE },
    { label: "COMPLETADOS", value: `${completedCount}`, color: C_PRIMARY },
    { label: "INCOMPLETOS", value: `${incompleteCount}`, color: C_ORANGE },
    { label: "FALTANTES", value: `${missingCount}`, color: C_RED },
    { label: "PROM. TRAMO", value: avgStr, color: C_GRAY },
  ];
  kpis.forEach((k, i) => {
    const x = 24 + i * (kpiW + 6);
    doc
      .roundedRect(x, kpiY, kpiW, 70, 8)
      .fillColor(C_WHITE)
      .lineWidth(1)
      .strokeColor(C_BORDER)
      .fillAndStroke();
    doc.rect(x, kpiY, kpiW, 4).fillColor(k.color).fill();
    doc
      .fillColor(C_GRAY)
      .font("Helvetica-Bold")
      .fontSize(6)
      .text(k.label, x + 8, kpiY + 16);
    doc
      .fillColor(C_DARK)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(k.value, x + 8, kpiY + 30);
  });

  // ─── PIE CHART ────────────────────────────────────────────────────────────
  const pieY = 310;
  const groupW = 330;
  const pCX = (612 - groupW) / 2 + 65;
  const pCY = pieY + 90;
  const pieR = 65;

  doc
    .fillColor(C_DARK)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("DISTRIBUCIÓN DE PUNTOS", 24, pieY);
  doc
    .rect(0, pieY + 18, 612, 1)
    .fillColor(C_BORDER)
    .fill();

  const slices = [
    { label: "Completados", count: completedCount, color: C_PRIMARY },
    { label: "Incompletos", count: incompleteCount, color: C_ORANGE },
    { label: "Faltantes", count: missingCount, color: C_RED },
  ];

  const activeSlices = slices.filter((s) => s.count > 0);
  if (activeSlices.length === 1) {
    doc.circle(pCX, pCY, pieR).fillColor(activeSlices[0].color).fill();
  } else if (activeSlices.length > 1) {
    let angle = -Math.PI / 2;
    slices.forEach((slice) => {
      if (slice.count === 0) return;
      const sweep = (slice.count / totalPoints) * 2 * Math.PI;
      const safeSweep = Math.min(sweep, 2 * Math.PI - 0.0001);
      const x1 = pCX + pieR * Math.cos(angle);
      const y1 = pCY + pieR * Math.sin(angle);
      const x2 = pCX + pieR * Math.cos(angle + safeSweep);
      const y2 = pCY + pieR * Math.sin(angle + safeSweep);
      const largeArc = safeSweep > Math.PI ? 1 : 0;

      doc
        .save()
        .path(
          `M ${pCX} ${pCY} L ${x1} ${y1} A ${pieR} ${pieR} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        )
        .fillColor(slice.color)
        .fill()
        .restore();
      angle += sweep;
    });
  }

  doc
    .circle(pCX, pCY, pieR * 0.52)
    .fillColor(C_WHITE)
    .fill();
  doc
    .fillColor(C_DARK)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(`${totalPoints}`, pCX - 20, pCY - 12, { width: 40, align: "center" });
  doc
    .fillColor(C_GRAY)
    .font("Helvetica")
    .fontSize(7)
    .text("TOTAL", pCX - 20, pCY + 10, { width: 40, align: "center" });

  const legendX = pCX + pieR + 30;
  let legendY = pieY + 50;
  slices.forEach((slice) => {
    const pct =
      totalPoints > 0 ? Math.round((slice.count / totalPoints) * 100) : 0;
    doc.roundedRect(legendX, legendY, 170, 36, 6).fillColor(C_LIGHT).fill();
    doc.rect(legendX, legendY, 4, 36).fillColor(slice.color).fill();
    doc
      .fillColor(C_GRAY)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(slice.label.toUpperCase(), legendX + 14, legendY + 8);
    doc
      .fillColor(C_DARK)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(`${slice.count}`, legendX + 14, legendY + 17);
    doc
      .fillColor(C_GRAY)
      .font("Helvetica")
      .fontSize(9)
      .text(`${pct}%`, legendX + 130, legendY + 20);
    legendY += 44;
  });

  // ─── Table ─────────────────────────────────────────────────────────
  const tableY = pieY + 200;
  doc
    .fillColor(C_DARK)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("DETALLE DE PUNTOS DE CONTROL", 24, tableY);
  doc
    .rect(0, tableY + 18, 612, 1)
    .fillColor(C_BORDER)
    .fill();

  const thY = tableY + 26;
  doc.rect(24, thY, 564, 22).fillColor(C_DARK).fill();
  doc
    .fillColor(C_WHITE)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("#", 34, thY + 7)
    .text("PUNTO DE CONTROL", 60, thY + 7)
    .text("ESTADO", 440, thY + 7)
    .text("EVIDENCIA", 510, thY + 7);

  let rowY = thY + 22;
  let rowNum = 1;

  const drawRow = (label: string, statusLabel: string, hasEv: boolean) => {
    if (rowY > 700) {
      doc.addPage();
      rowY = 40;
    }
    const bg = rowNum % 2 === 0 ? C_LIGHT : C_WHITE;
    doc.rect(24, rowY, 564, 22).fillColor(bg).fill();
    doc
      .fillColor(C_GRAY)
      .font("Helvetica")
      .fontSize(8)
      .text(`${rowNum}`, 34, rowY + 7);
    doc
      .fillColor(C_DARK)
      .font("Helvetica")
      .fontSize(8)
      .text(label, 60, rowY + 7, { width: 360 });
    doc
      .fillColor(C_DARK)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(statusLabel, 435, rowY + 7, { width: 70, align: "center" });
    doc
      .fillColor(hasEv ? C_PRIMARY : C_GRAY)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(hasEv ? "✓ Sí" : "— No", 510, rowY + 7, { width: 60 });
    rowY += 22;
    rowNum++;
  };

  scans.forEach((scan: any) => {
    const locName = scan.data?.location?.name || "Punto";
    const hasMedia =
      scan.data?.media &&
      Array.isArray(scan.data.media) &&
      scan.data.media.length > 0;
    drawRow(locName, hasMedia ? "COMPLETADO" : "INCOMPLETO", hasMedia);
  });
  missingLocs.forEach((rl: any) => {
    drawRow(rl.location?.name || "Punto", "FALTANTE", false);
  });

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.rect(0, 752, 612, 40).fillColor(C_DARK).fill();
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(7)
      .text("FANSAL — Sistema de Gestión de Seguridad", 24, 763);
    doc
      .fillColor("#94a3b8")
      .font("Helvetica-Bold")
      .fontSize(7)
      .text("powered by axzy.dev", 24, 775);
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(7)
      .text(`Página ${i + 1} de ${totalPages}`, 0, 763, {
        align: "center",
        width: 612,
      });
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(7)
      .text(`Generado: ${new Date().toLocaleString("es-MX")}`, 24, 775, {
        align: "right",
        width: 564,
      });
  }

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
};
