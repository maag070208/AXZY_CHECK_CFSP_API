import { prismaClient as prisma } from "@src/core/config/database";
import {
  PDF_COLOR_BLACK,
  PDF_COLOR_SUCCESS,
  PDF_COLOR_WHITE,
} from "@src/core/config/constants";
import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import fs from "fs";
import path from "path";

export const getDataTableLocations = async (
  params: ITDataTableFetchParams,
): Promise<ITDataTableResponse<any>> => {
  try {
    const { page, limit, filters } = params;
    const take = Number(limit) || 10;
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const searchTerm = filters?.name || "";

    // Add clientId filter if provided
    let clientIdFilter = undefined;
    if (filters?.clientId) {
      clientIdFilter = filters.clientId;
    }
    let zoneIdFilter = undefined;
    if (filters?.zoneId) {
      zoneIdFilter = filters.zoneId;
    }

    if (searchTerm) {
      const search = `%${searchTerm}%`;
      try {
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS unaccent;`.catch(
          () => {},
        );

        let query = `
                SELECT l.*, c.name as "clientName" FROM "Location" l
                LEFT JOIN "Client" c ON c.id = l."clientId"
                WHERE l."softDelete" = false
                AND (
                    unaccent(l."name") ILIKE unaccent(${search}) OR
                    unaccent(l."reference") ILIKE unaccent(${search})
                )
            `;
        if (clientIdFilter) {
          query += ` AND l."clientId" = '${clientIdFilter}'`;
        }
        if (zoneIdFilter) {
          query += ` AND l."zoneId" = '${zoneIdFilter}'`;
        }
        query += ` ORDER BY l."createdAt" DESC LIMIT ${take} OFFSET ${skip}`;

        const rows: any = await prisma.$queryRawUnsafe(query);

        let countQuery = `
                SELECT COUNT(*)::int as count FROM "Location" l
                WHERE l."softDelete" = false
                AND (
                    unaccent(l."name") ILIKE unaccent(${search}) OR
                    unaccent(l."reference") ILIKE unaccent(${search})
                )
            `;
        if (clientIdFilter) {
          countQuery += ` AND l."clientId" = '${clientIdFilter}'`;
        }
        if (zoneIdFilter) {
          countQuery += ` AND l."zoneId" = '${zoneIdFilter}'`;
        }

        const totalRes: any = await prisma.$queryRawUnsafe(countQuery);
        return { rows, total: totalRes[0]?.count || 0 };
      } catch (rawError) {
        logger.warn("Fuzzy search failed", rawError);
      }
    }

    const prismaParams = getPrismaPaginationParams(params);
    const whereClause: any = {
      ...prismaParams.where,
      softDelete: false,
    };
    if (clientIdFilter) {
      whereClause.clientId = clientIdFilter;
    }
    if (zoneIdFilter) {
      whereClause.zoneId = zoneIdFilter;
    }

    const [rows, total] = await Promise.all([
      prisma.location.findMany({
        ...prismaParams,
        where: whereClause,
        include: {
          client: { select: { name: true } },
          zone: { select: { name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: prismaParams.orderBy || { createdAt: "desc" },
      }),
      prisma.location.count({
        where: whereClause,
      }),
    ]);

    return { rows, total };
  } catch (error) {
    logger.error("Error getting locations:", error);
    return { rows: [], total: 0 };
  }
};

export const getAllLocations = async (clientId?: string) => {
  const where: any = { softDelete: false };
  if (clientId) {
    where.clientId = clientId;
  }
  return await prisma.location.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, tasks: true },
  });
};

export const createLocation = async (data: {
  clientId: string;
  zoneId?: string;
  name: string;
  reference?: string;
  aisle?: string;
  spot?: string;
  number?: string;
}) => {
  return await prisma.location.create({
    data,
  });
};

export const updateLocation = async (id: string, data: any) => {
  return await prisma.location.update({
    where: { id },
    data,
  });
};

export const deleteLocation = async (id: string) => {
  const location = await prisma.location.findUnique({
    where: { id },
  });

  if (!location) throw new Error("Location not found");

  return await prisma.location.update({
    where: { id },
    data: { softDelete: true, active: false },
  });
};

export const getAvailableLocation = async () => {
  return await prisma.location.findFirst({
    where: { active: true, softDelete: false },
  });
};

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { logger } from "@src/core/utils/logger";

export const generateQRPDF = async (ids: string[]) => {
  const locations = await prisma.location.findMany({
    where: { id: { in: ids } },
    include: { zone: true },
  });

  const doc = new PDFDocument({ margin: 0, size: "LETTER" });
  const buffers: any[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  const qrsPerPage = 6;
  const cardW = 306;
  const cardH = 264;
  const startX = 0;
  const startY = 0;
  const gapX = 0;
  const gapY = 0;

  const logoPath = path.join(process.cwd(), "src/assets/logo_fansal.png");
  const hasLogo = fs.existsSync(logoPath);
  logger.debug(`[QR GEN] Logo path: ${logoPath}, found: ${hasLogo}`);

  for (let i = 0; i < locations.length; i++) {
    if (i > 0 && i % qrsPerPage === 0) {
      doc.addPage();
    }

    const loc = locations[i];
    const pageIdx = i % qrsPerPage;
    const col = pageIdx % 2;
    const row = Math.floor(pageIdx / 2);

    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    const displayName = loc.name;

    // DESIGN CONSTANTS
    const PREMIUM_EMERALD = "#10B981";
    const SLATE_600 = "#475569";
    const SLATE_400 = "#94A3B8";

    const headerH = 110;
    const qrContainerSize = 135;
    const qrSize = 120;
    const cornerRadius = 20;
    const qrContX = x + cardW / 2 - qrContainerSize / 2;
    const qrContY = y + 75; // Higher overlap

    // 1. Vibrant Emerald Header
    doc.rect(x, y, cardW, headerH).fillColor(PREMIUM_EMERALD).fill();

    // 2. Header Text
    doc
      .fillColor(PDF_COLOR_WHITE)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("PUNTO DE CONTROL", x, y + 25, {
        width: cardW,
        align: "center",
        characterSpacing: 1,
      });

    doc
      .fontSize(7)
      .font("Helvetica")
      .text("ESCANEA CON TU APP CHECK", x, y + 50, {
        width: cardW,
        align: "center",
        characterSpacing: 2,
      });

    // 3. QR Container with Soft Shadow-like Border
    doc
      .roundedRect(
        qrContX,
        qrContY,
        qrContainerSize,
        qrContainerSize,
        cornerRadius,
      )
      .fillColor(PDF_COLOR_WHITE)
      .strokeColor("#F1F5F9")
      .lineWidth(2)
      .fillAndStroke();

    // 4. QR Code & Center Logo
    const qrDataUrl = await QRCode.toDataURL(
      JSON.stringify({
        id: loc.id,
        name: loc.name,
        type: "LOCATION",
      }),
      {
        margin: 1,
        width: 300,
        color: {
          dark: PDF_COLOR_BLACK,
          light: PDF_COLOR_WHITE,
        },
      },
    );

    doc.image(
      qrDataUrl,
      qrContX + (qrContainerSize - qrSize) / 2,
      qrContY + (qrContainerSize - qrSize) / 2,
      { width: qrSize },
    );

    // Center Logo Backing & Image
    if (hasLogo) {
      const logoSize = 22;
      const logoX = qrContX + qrContainerSize / 2 - logoSize / 2;
      const logoY = qrContY + qrContainerSize / 2 - logoSize / 2;

      doc
        .rect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4)
        .fillColor(PDF_COLOR_WHITE)
        .fill();

      doc.image(logoPath, logoX, logoY, { width: logoSize });
    }

    // 5. Slim Name Pill (Placed below QR for better balance)
    const pillY = qrContY + qrContainerSize + 10;
    doc
      .roundedRect(x + 60, pillY, cardW - 120, 18, 9)
      .fillColor("#F8FAFC")
      .strokeColor(PREMIUM_EMERALD)
      .lineWidth(0.5)
      .fillAndStroke();

    doc
      .fillColor(PREMIUM_EMERALD)
      .font("Helvetica-Bold")
      .fontSize(6)
      .text(displayName.toUpperCase(), x + 60, pillY + 6, {
        width: cardW - 120,
        align: "center",
        ellipsis: true,
      });

    // 6. Refined Footer
    const footerY = pillY + 22;
    doc
      .fillColor(SLATE_600)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("PUNTO PROTEGIDO POR AXZY", x, footerY, {
        width: cardW,
        align: "center",
        characterSpacing: 0.5,
      });

    doc
      .fillColor("#94A3B8") // Slate-400
      .font("Helvetica")
      .fontSize(7)
      .text("checkapp.axzy.dev", x, footerY + 10, {
        width: cardW,
        align: "center",
      });

    // 7. Cutting Guide Border
    doc
      .rect(x, y, cardW, cardH)
      .lineWidth(1)
      .strokeColor("#E2E8F0") // Slate-200 for subtle cutting guide
      .stroke();
  }

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });
  });
};
