import { prismaClient } from "@src/core/config/database";
import { TResult } from '@src/core/dto/TResult';
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const prisma = prismaClient;

// Use the key found in WEB .env for static maps
const GOOGLE_MAPS_KEY = "AIzaSyBEcey4scuaufZ6TD4oOZZKjO-CIOVXa8w";

export const getDataTableRounds = async (params: ITDataTableFetchParams, user?: any): Promise<ITDataTableResponse<any>> => {
    const customFilters = params.filters || {};
    const cleanFilters: any = {};
    if (params.filters) {
        for (const [key, value] of Object.entries(params.filters)) {
            if (key !== 'refreshKey' && key !== 'date') {
                if (key === 'guard') {
                    cleanFilters['guardId'] = Number(value);
                } else if (key === 'client') {
                    cleanFilters['clientId'] = Number(value);
                } else if (key === 'search') {
                    cleanFilters.guard = {
                        OR: [
                            { name: { contains: String(value), mode: 'insensitive' } },
                            { lastName: { contains: String(value), mode: 'insensitive' } },
                            { username: { contains: String(value), mode: 'insensitive' } },
                        ]
                    };
                } else {
                    cleanFilters[key] = value;
                }
            }
        }
    }

    const prismaParams = getPrismaPaginationParams({ ...params, filters: cleanFilters });

    if (customFilters.date) {
        const dateParams = Array.isArray(customFilters.date) ? customFilters.date : [customFilters.date, customFilters.date];
        const start = new Date(dateParams[0]);
        const end = new Date(dateParams[1] || dateParams[0]);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            prismaParams.where.startTime = { gte: start, lte: end };
        }
    }

    if (user?.role === 'RESDN' && user.clientId) {
        prismaParams.where.clientId = user.clientId;
    }

    const [rows, total] = await Promise.all([
        prisma.round.findMany({
            ...prismaParams,
            include: {
                guard: true,
                client: true,
                recurringConfiguration: {
                    include: { client: true }
                }
            }
        }),
        prisma.round.count({ where: prismaParams.where })
    ]);

    return { rows, total };
};

export const startRound = async (guardId: number, clientId?: number, recurringConfigurationId?: number): Promise<TResult<any>> => {
    try {
        const round = await prisma.round.create({
            data: {
                guardId, clientId, recurringConfigurationId,
                status: 'IN_PROGRESS',
                startTime: new Date()
            }
        });
        return { success: true, data: round, messages: [] };
    } catch (error: any) {
        return { success: false, data: null, messages: [error.message] };
    }
};

export const endRound = async (id: number): Promise<TResult<any>> => {
    try {
        const round = await prisma.round.update({
            where: { id },
            data: { status: 'COMPLETED', endTime: new Date() }
        });
        return { success: true, data: round, messages: [] };
    } catch (error: any) {
        return { success: false, data: null, messages: [error.message] };
    }
};

export const getCurrentRound = async (guardId: number): Promise<TResult<any>> => {
    try {
        const round = await prisma.round.findFirst({
            where: { guardId, status: 'IN_PROGRESS' },
            include: {
                recurringConfiguration: {
                    include: {
                        recurringLocations: {
                            include: { location: { include: { zone: true } } },
                            orderBy: { order: 'asc' }
                        }
                    }
                }
            }
        });
        return { success: true, data: round, messages: [] };
    } catch (error: any) {
        return { success: false, data: null, messages: [error.message] };
    }
};

export const getRounds = async (date?: string, guardId?: number, user?: any): Promise<TResult<any>> => {
    try {
        const where: any = {};
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.startTime = { gte: start, lte: end };
        }
        if (guardId) where.guardId = guardId;
        if (user?.role === 'RESDN' && user.clientId) where.clientId = user.clientId;

        const rounds = await prisma.round.findMany({
            where,
            include: { guard: true, recurringConfiguration: true, client: true },
            orderBy: { startTime: 'desc' }
        });
        return { success: true, data: rounds, messages: [] };
    } catch (error: any) {
        return { success: false, data: null, messages: [error.message] };
    }
};

export interface IRoundDetail {
    round: any;
    timeline: Array<{
        type: 'START' | 'END' | 'SCAN' | 'INCIDENT';
        timestamp: Date;
        description: string;
        data: any;
    }>;
}

export const getRoundDetail = async (id: number, user?: any): Promise<TResult<IRoundDetail | null>> => {
    try {
        const round = await prisma.round.findUnique({
            where: { id },
            include: {
                guard: true,
                client: { include: { locations: true } },
                recurringConfiguration: {
                    include: {
                        recurringLocations: {
                            include: { location: true },
                            orderBy: { order: 'asc' }
                        },
                        client: true
                    }
                }
            }
        });

        if (!round) return { success: false, data: null, messages: ['Ronda no encontrada'] };
        if (user?.role === 'RESDN' && user.clientId && round.clientId !== user.clientId) {
            return { success: false, data: null, messages: ['No tienes permiso para ver los detalles de esta ronda.'] };
        }

        const start = round.startTime;
        const end = round.endTime || new Date();

        const scans = await prisma.kardex.findMany({
            where: { timestamp: { gte: start, lte: end }, userId: round.guardId },
            include: { location: true, assignment: { include: { tasks: true } } },
            orderBy: { timestamp: 'asc' }
        });

        const incidents = await prisma.incident.findMany({
            where: { createdAt: { gte: start, lte: end }, guardId: round.guardId },
            include: { category: true },
            orderBy: { createdAt: 'asc' }
        });

        const timeline: any[] = [];
        timeline.push({ type: 'START', timestamp: round.startTime, description: 'Inicio de Ronda', data: null });
        scans.forEach(s => {
            timeline.push({
                type: 'SCAN', timestamp: s.timestamp,
                description: `Escaneo: ${(s as any).location?.name || 'Punto desconocido'}`,
                data: s
            });
        });
        incidents.forEach(i => {
            timeline.push({
                type: 'INCIDENT', timestamp: i.createdAt,
                description: `Incidente: ${(i as any).category?.name || 'Sin categoría'}`,
                data: i
            });
        });
        if (round.status === 'COMPLETED' && round.endTime) {
            timeline.push({ type: 'END', timestamp: round.endTime, description: 'Cierre de Ronda', data: null });
        }
        timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return { success: true, data: { round, timeline }, messages: [] };
    } catch (error: any) {
        return { success: false, data: null, messages: [error.message] };
    }
};

const fetchImageAsBuffer = async (url: string): Promise<Buffer | null> => {
    try {
        if (url.startsWith('data:image')) {
            const base64Data = url.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        }
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(response.data);
    } catch (error) {
        return null;
    }
};

export const generateRoundPDF = async (id: number, user?: any): Promise<Buffer> => {
    const detailRes = await getRoundDetail(id, user);
    if (!detailRes.success || !detailRes.data) {
        throw new Error(detailRes.messages?.[0] || 'Ronda no encontrada');
    }

    const { round, timeline } = detailRes.data;

    const doc = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));

    const primaryColor = '#1e293b';     
    const greenColor = '#10b981';      
    const blueColor = '#3b82f6';       
    const purpleColor = '#a855f7';     
    const orangeColor = '#f97316';     
    const grayColor = '#64748b';       
    const borderColor = '#f1f5f9';     
    const cardBgColor = '#ffffff';

    // Header
    doc.rect(0, 0, 612, 110).fillColor('#f8fafc').fill();
    const logoPath = path.join(process.cwd(), 'src/assets/logo_fansal.png');
    if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 25, { width: 70 });

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(22)
       .text(round.recurringConfiguration?.title?.toUpperCase() || `RONDA #${round.id}`, 120, 35);

    const infoY = 70;
    doc.fontSize(8).fillColor(grayColor).font('Helvetica-Bold').text('GUARDIA', 120, infoY);
    doc.fontSize(9).fillColor(primaryColor).font('Helvetica').text(`${round.guard.name} ${round.guard.lastName}`, 120, infoY + 12);
    doc.fontSize(8).fillColor(grayColor).font('Helvetica-Bold').text('CLIENTE', 270, infoY);
    doc.fontSize(9).fillColor(primaryColor).font('Helvetica').text(round.client?.name || 'Sin Cliente', 270, infoY + 12);
    doc.fontSize(8).fillColor(grayColor).font('Helvetica-Bold').text('FECHA DE INICIO', 420, infoY);
    doc.fontSize(9).fillColor(primaryColor).font('Helvetica').text(new Date(round.startTime).toLocaleString(), 420, infoY + 12);

    // Metrics
    const metricsY = 125;
    const boxW = 170;
    const boxH = 80;

    const start = new Date(round.startTime);
    const end = round.endTime ? new Date(round.endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const durationStr = `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
    const scans = timeline.filter((e: any) => e.type === 'SCAN');
    const avgMs = scans.length > 0 ? durationMs / scans.length : 0;
    const avgStr = `${Math.floor(avgMs / 60000)}m ${Math.floor((avgMs % 60000) / 1000)}s`;

    doc.roundedRect(40, metricsY, boxW, boxH, 12).fillColor(cardBgColor).lineWidth(1).strokeColor(borderColor).stroke();
    doc.fillColor(blueColor).circle(65, metricsY + 25, 12).fill();
    doc.save().translate(59, metricsY + 19).scale(0.4).fillColor('white').path('M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2zm0,18c-4.41,0-8-3.59-8-8s3.59-8,8-8,8,3.59,8,8-3.59,8-8,8zm.5-13H11v6l5.25,3.15.75-1.23-4.5-2.67V7z').fill().restore();
    doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(7).text('DURACIÓN TOTAL', 85, metricsY + 22);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16).text(durationStr, 60, metricsY + 45);

    doc.roundedRect(220, metricsY, boxW, boxH, 12).fillColor(cardBgColor).strokeColor(borderColor).stroke();
    doc.fillColor(purpleColor).circle(245, metricsY + 25, 12).fill();
    doc.save().translate(239, metricsY + 19).scale(0.4).fillColor('white').path('M12,2C8.13,2,5,5.13,5,9c0,5.25,7,13,7,13s7-7.75,7-13C19,5.13,15.87,2,12,2z M12,11.5c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5s2.5,1.12,2.5,2.5S13.38,11.5,12,11.5z').fill().restore();
    doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(7).text('PUNTOS CUBIERTOS', 265, metricsY + 22);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16).text(`${scans.length}`, 240, metricsY + 45);
    doc.fillColor(grayColor).fontSize(8).text(`/ ${round.recurringConfiguration?.recurringLocations?.length || scans.length}`, 265, metricsY + 48);

    doc.roundedRect(400, metricsY, boxW, boxH, 12).fillColor(cardBgColor).strokeColor(borderColor).stroke();
    doc.fillColor(orangeColor).circle(425, metricsY + 25, 12).fill();
    doc.save().translate(419, metricsY + 19).scale(0.4).fillColor('white').path('M10,20h4V4h-4V20z M4,20h4v-7H4V20z M16,9v11h4V9H16z').fill().restore();
    doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(7).text('PROMEDIO POR TRAMO', 445, metricsY + 22);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16).text(avgStr, 420, metricsY + 45);

    // Route Map
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('RUTA RECORRIDA', 40, 230);
    const mapNodes: any[] = [];
    const visitedLocations = new Set<string>();
    mapNodes.push({ label: 'Inicio', status: 'START' });
    scans.forEach((scan: any) => {
        const locId = String(scan.data?.location?.id);
        const hasMedia = scan.data?.media && Array.isArray(scan.data.media) && scan.data.media.length > 0;
        let status = hasMedia ? 'SUCCESS' : 'INCOMPLETE';
        if (visitedLocations.has(locId) && hasMedia) {
             const alreadySuccess = mapNodes.some(n => n.label === scan.data?.location?.name && n.status === 'SUCCESS');
             if (alreadySuccess) status = 'DUPLICATE';
        }
        visitedLocations.add(locId);
        mapNodes.push({ label: scan.data?.location?.name || 'Punto', status });
    });
    const expectedLocs = round.recurringConfiguration?.recurringLocations || [];
    expectedLocs.forEach((rl: any) => {
        if (!visitedLocations.has(String(rl.locationId))) mapNodes.push({ label: rl.location?.name || 'Punto', status: 'MISSING' });
    });
    if (round.status === 'COMPLETED') mapNodes.push({ label: 'Fin', status: 'END' });

    let routeY = 260;
    const ptsPerRow = 8;
    const rowH = 60;
    const gap = 532 / (ptsPerRow - 1);
    mapNodes.forEach((node, idx) => {
        const r = Math.floor(idx / ptsPerRow);
        const cIdx = idx % ptsPerRow;
        const x = 40 + (cIdx * gap);
        const y = routeY + (r * rowH);
        if (cIdx > 0) doc.moveTo(x - gap + 7, y).lineTo(x - 7, y).strokeColor(borderColor).lineWidth(1.5).stroke();
        let c = '#cbd5e1'; 
        if (node.status === 'START') c = blueColor;
        if (node.status === 'END') c = primaryColor;
        if (node.status === 'SUCCESS') c = greenColor;
        if (node.status === 'INCOMPLETE') c = orangeColor;
        if (node.status === 'DUPLICATE') c = '#ef4444'; 
        doc.circle(x, y, 7).fillColor(c).fill();
        doc.circle(x, y, 3).fillColor('white').fill();
        doc.fontSize(5.5).fillColor(grayColor).font('Helvetica').text(node.label, x - 20, y + 10, { width: 40, align: 'center' });
    });

    const timelineStartY = routeY + (Math.ceil(mapNodes.length / ptsPerRow) * rowH) + 10;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('LÍNEA DE TIEMPO', 40, timelineStartY);
    let currentY = timelineStartY + 30;

    for (const event of timeline) {
        if (event.type === 'INCIDENT') continue;
        const hasNotes = !!event.data?.notes;
        const hasImages = event.data?.media && Array.isArray(event.data.media) && event.data.media.length > 0;
        const hasGPS = event.data?.latitude && event.data?.longitude;
        
        let cardH = 85; 
        if (hasNotes) cardH += 35;
        if (hasImages) cardH += 180;
        if (hasGPS) cardH += 220; // Room for map and coordinates

        if (currentY + cardH > 740) { doc.addPage(); currentY = 40; }

        doc.moveTo(55, currentY).lineTo(55, currentY + cardH).strokeColor(borderColor).lineWidth(2).stroke();
        doc.circle(55, currentY + 20, 6).fillColor('white').strokeColor(blueColor).lineWidth(1.5).stroke();

        doc.roundedRect(80, currentY, 492, cardH - 15, 10).fillColor(cardBgColor).strokeColor(borderColor).lineWidth(1).stroke();
        
        const timeStr = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(8).text(timeStr, 95, currentY + 15);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text(event.description.toUpperCase(), 170, currentY + 14);

        let subY = currentY + 35;

        if (event.type === 'SCAN' && event.data) {
            doc.roundedRect(95, subY, 462, 35, 8).fillColor('#f5f3ff').fill();
            doc.fillColor('#6d28d9').font('Helvetica-Bold').fontSize(8).text('UBICACIÓN', 110, subY + 14);
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text(event.data.location?.name || 'N/A', 170, subY + 13);
            subY += 45;

            doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(8).text('NOTAS:', 95, subY);
            doc.fillColor(primaryColor).font('Helvetica-Oblique').fontSize(9).text(`"${event.data.notes || 'Check completado'}"`, 95, subY + 12, { width: 440 });
            subY += 35;

            if (hasGPS) {
                // GPS Section Header
                doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(8).text('UBICACIÓN GPS', 95, subY);
                doc.fontSize(7).fillColor(grayColor).text('Coordenadas exactas del punto de control', 95, subY + 10);
                subY += 25;

                // Static Map Image
                const lat = event.data.latitude;
                const lng = event.data.longitude;
                const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x200&markers=color:green%7C${lat},${lng}&key=${GOOGLE_MAPS_KEY}`;
                
                const mapBuffer = await fetchImageAsBuffer(mapUrl);
                if (mapBuffer) {
                    doc.image(mapBuffer, 95, subY, { width: 300, height: 150 });
                    subY += 160;
                }

                // Coordinates detail box
                doc.roundedRect(95, subY, 300, 30, 5).fillColor('#f8fafc').lineWidth(0.5).strokeColor(borderColor).stroke();
                doc.fillColor(grayColor).fontSize(7).text('Latitud', 105, subY + 5);
                doc.fillColor(primaryColor).fontSize(9).text(`${lat}`, 105, subY + 15);
                doc.fillColor(grayColor).fontSize(7).text('Longitud', 205, subY + 5);
                doc.fillColor(primaryColor).fontSize(9).text(`${lng}`, 205, subY + 15);
                subY += 40;
            }

            if (hasImages) {
                doc.fillColor(grayColor).font('Helvetica-Bold').fontSize(8).text('EVIDENCIA FOTOGRÁFICA', 95, subY);
                subY += 15;
                const media = event.data.media[0];
                const url = typeof media === 'string' ? media : (media.url || media.key);
                if (url) {
                    const imgBuffer = await fetchImageAsBuffer(url);
                    if (imgBuffer) doc.image(imgBuffer, 95, subY, { fit: [200, 150] });
                }
            }
        } else {
            doc.fillColor(grayColor).font('Helvetica-Oblique').fontSize(9).text(event.type === 'START' ? 'Punto de partida' : 'Punto de llegada', 95, subY + 10);
        }
        currentY += cardH;
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fillColor(grayColor).fontSize(8).text(`Página ${i + 1} de ${totalPages}`, 0, 760, { align: 'center', width: 612 });
    }
    doc.end();

    return new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
};
