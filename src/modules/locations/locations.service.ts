import { prismaClient } from "@src/core/config/database"; 
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import fs from 'fs';

const prisma = prismaClient;

export const getDataTableLocations = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<any>> => {
  try {
    const { page, limit, filters } = params;
    const take = Number(limit) || 10;
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const searchTerm = filters?.name || "";
    
    // Add clientId filter if provided
    let clientIdFilter = undefined;
    if (filters?.clientId) {
        clientIdFilter = Number(filters.clientId);
    }
    let zoneIdFilter = undefined;
    if (filters?.zoneId) {
        zoneIdFilter = Number(filters.zoneId);
    }

    if (searchTerm) {
        const search = `%${searchTerm}%`;
        try {
            await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS unaccent;`.catch(() => {});
            
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
               query += ` AND l."clientId" = ${clientIdFilter}`;
            }
            if (zoneIdFilter) {
                query += ` AND l."zoneId" = ${zoneIdFilter}`;
            }
            query += ` ORDER BY l."id" DESC LIMIT ${take} OFFSET ${skip}`;
            
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
               countQuery += ` AND l."clientId" = ${clientIdFilter}`;
            }
            if (zoneIdFilter) {
                countQuery += ` AND l."zoneId" = ${zoneIdFilter}`;
            }

            const totalRes: any = await prisma.$queryRawUnsafe(countQuery);
            return { rows, total: totalRes[0]?.count || 0 };
        } catch (rawError) {
            console.warn("Fuzzy search failed", rawError);
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
        include: { client: { select: { name: true } }, zone: { select: { name: true } }, _count: { select: { tasks: true } } },
        orderBy: prismaParams.orderBy || { id: 'desc' }
      }),
      prisma.location.count({
        where: whereClause
      })
    ]);

    return { rows, total };
  } catch (error) {
    console.error("Error getting locations:", error);
    return { rows: [], total: 0 };
  }
};

export const getAllLocations = async () => {
  return await prisma.location.findMany({
    where: { softDelete: false },
    orderBy: { id: "desc" },
    include: { client: { select: { name: true } }, tasks: true },
  });
};

export const createLocation = async (data: {
  clientId: number;
  zoneId?: number;
  name: string;
  reference?: string;
  aisle?: string;
  spot?: string;
  number?: string;
}) => {
  return await prisma.location.create({
    data
  });
};

export const updateLocation = async (id: number, data: any) => {
    return await prisma.location.update({
        where: { id },
        data
    });
};

export const deleteLocation = async (id: number) => {
    const location = await prisma.location.findUnique({
        where: { id },
    });

    if (!location) throw new Error("Location not found");

    return await prisma.location.update({
        where: { id },
        data: { softDelete: true, active: false }
    });
};

export const getAvailableLocation = async () => {
  return await prisma.location.findFirst({
    where: { active: true, softDelete: false },
  });
};

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export const generateQRPDF = async (ids: number[]) => {
    const locations = await prisma.location.findMany({
        where: { id: { in: ids } },
        include: { client: true, zone: true }
    });

    const doc = new PDFDocument({ margin: 0, size: 'LETTER' });
    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));

    const qrsPerPage = 6;
    const cardW = 306;
    const cardH = 264;
    const startX = 0;
    const startY = 0;
    const gapX = 0;
    const gapY = 0;

    const logoPath = '/Users/maag/DEV/AXZY/CFSP/API/src/assets/logo_fansal.png';
    const hasLogo = fs.existsSync(logoPath);

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

        // Card Border/Background (White with Emerald Border - No border radius for easier cutting)
        doc.rect(x, y, cardW, cardH)
           .lineWidth(1)
           .strokeColor('#10b981')
           .fillColor('#FFFFFF')
           .fillAndStroke();

        // Logo or Text Brand (Emerald)
        if (hasLogo) {
            doc.image(logoPath, x + (cardW / 2) - 42.5, y + 15, { width: 85 });
        } else {
            doc.fillColor('#10b981').font('Helvetica-Bold').fontSize(24).text('AXZY', x, y + 40, { width: cardW, align: 'center' });
        }

        // Location Name (Black, size 8)
        doc.fillColor('#000000')
           .font('Helvetica-Bold')
           .fontSize(8)
           .text(loc.name.toUpperCase(), x + 20, y + 100, {
                width: cardW - 40,
                align: 'center',
                lineGap: 2
           });

        // QR Code (Black on White)
        const qrDataUrl = await QRCode.toDataURL(JSON.stringify({
            id: loc.id,
            type: 'LOCATION'
        }), {
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        doc.image(qrDataUrl, x + (cardW / 2) - 55, y + 125, { width: 110 });
    }

    doc.end();

    return new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
    });
};
