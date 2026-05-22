import { getEndOfDay, getStartOfDay } from "@src/core/utils/date-time.utils";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

export interface MatrixLocationRow {
  locationId: string;
  name: string;
  scansByDay: { [dateString: string]: boolean };
}

export const generateAdministrativeMatrixPDFBuffer = async (
  startDate: string,
  endDate: string,
  rows: MatrixLocationRow[],
): Promise<Buffer> => {
  const doc = new PDFDocument({
    margin: 0,
    size: "LETTER",
    layout: "landscape",
    bufferPages: true,
  });
  const buffers: any[] = [];
  doc.on("data", buffers.push.bind(buffers));

  const C_DARK = "#1e293b";
  const C_PRIMARY = "#10b981";
  const C_RED = "#ef4444";
  const C_GRAY = "#64748b";
  const C_LIGHT = "#f8fafc";
  const C_BORDER = "#e2e8f0";
  const C_WHITE = "#ffffff";

  // Calculate boundaries
  const start = dayjs(getStartOfDay(startDate));
  const end = dayjs(getEndOfDay(endDate));

  // Helper to translate month to Spanish
  const getSpanishMonthName = (date: dayjs.Dayjs): string => {
    const monthNames = [
      "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];
    return `${monthNames[date.month()]} ${date.year()}`;
  };

  // Group days by Month
  const monthsMap: { [monthKey: string]: { monthName: string; days: { dateStr: string; dayNum: number }[] } } = {};
  let current = start.clone();
  while (current.isBefore(end) || current.isSame(end, "day")) {
    const monthKey = current.format("YYYY-MM");
    const monthName = getSpanishMonthName(current);

    if (!monthsMap[monthKey]) {
      monthsMap[monthKey] = {
        monthName,
        days: [],
      };
    }

    monthsMap[monthKey].days.push({
      dateStr: current.format("YYYY-MM-DD"),
      dayNum: current.date(),
    });

    current = current.add(1, "day");
  }

  const months = Object.values(monthsMap);

  const PAGE_WIDTH = 792;
  const PAGE_HEIGHT = 612;
  const MARGIN_X = 24;
  const MARGIN_Y = 24;
  const labelColWidth = 160;
  const availableWidth = PAGE_WIDTH - MARGIN_X * 2 - labelColWidth;

  const drawHeader = (monthTitle: string) => {
    doc.rect(0, 0, PAGE_WIDTH, 70).fillColor(C_WHITE).fill();
    doc
      .moveTo(0, 70)
      .lineTo(PAGE_WIDTH, 70)
      .strokeColor(C_BORDER)
      .lineWidth(0.5)
      .stroke();

    const logoPath = path.join(process.cwd(), "src/assets/logo_fansal.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 24, 12, { height: 46 });
    }

    doc
      .fillColor(C_DARK)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("FANSAL", 90, 20);
    doc
      .fillColor(C_GRAY)
      .font("Helvetica")
      .fontSize(8)
      .text("Matriz de Asistencia por Punto de Control", 90, 38);

    doc
      .fillColor(C_DARK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        `MES: ${monthTitle}`,
        PAGE_WIDTH - 250,
        24,
        { width: 226, align: "right" },
      );

    doc
      .fillColor(C_PRIMARY)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`RUTAS EVALUADAS: ${rows.length}`, PAGE_WIDTH - 250, 38, {
        width: 226,
        align: "right",
      });

    doc
      .fillColor(C_GRAY)
      .font("Helvetica")
      .fontSize(8)
      .text(
        `EMISIÓN: ${dayjs().format("DD/MM/YYYY HH:mm")}`,
        PAGE_WIDTH - 250,
        50,
        { width: 226, align: "right" },
      );
  };

  let isFirstPage = true;

  for (const month of months) {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    const daysInMonth = month.days;
    const dayColWidth = Math.min(availableWidth / daysInMonth.length, 25);
    const totalTableWidth = labelColWidth + daysInMonth.length * dayColWidth;

    let cursorY = 90;
    drawHeader(month.monthName);

    const drawTableHeader = () => {
      if (cursorY > PAGE_HEIGHT - 120) {
        doc.addPage();
        drawHeader(month.monthName);
        cursorY = 90;
      }

      doc.rect(MARGIN_X, cursorY, totalTableWidth, 20).fillColor(C_DARK).fill();
      doc.fillColor(C_WHITE).font("Helvetica-Bold").fontSize(8);
      doc.text("PUNTO DE CONTROL / LOCAL", MARGIN_X + 8, cursorY + 6);

      daysInMonth.forEach((day, idx) => {
        const x = MARGIN_X + labelColWidth + idx * dayColWidth;
        doc.text(`${day.dayNum}`, x, cursorY + 6, {
          width: dayColWidth,
          align: "center",
        });
      });

      cursorY += 20;
    };

    drawTableHeader();

    let rowIdx = 0;
    for (const row of rows) {
      if (cursorY > PAGE_HEIGHT - 60) {
        doc.addPage();
        drawHeader(month.monthName);
        cursorY = 90;
        drawTableHeader();
      }

      const bg = rowIdx % 2 === 0 ? C_LIGHT : C_WHITE;
      doc.rect(MARGIN_X, cursorY, totalTableWidth, 18).fillColor(bg).fill();
      doc
        .moveTo(MARGIN_X, cursorY + 18)
        .lineTo(MARGIN_X + totalTableWidth, cursorY + 18)
        .strokeColor(C_BORDER)
        .lineWidth(0.5)
        .stroke();

      doc
        .fillColor(C_DARK)
        .font("Helvetica")
        .fontSize(7)
        .text(row.name, MARGIN_X + 8, cursorY + 5, { width: labelColWidth - 10 });

      daysInMonth.forEach((day, idx) => {
        const x = MARGIN_X + labelColWidth + idx * dayColWidth;
        const isCompleted = row.scansByDay[day.dateStr];

        if (isCompleted) {
          doc
            .fillColor(C_PRIMARY)
            .font("ZapfDingbats")
            .fontSize(9)
            .text("4", x, cursorY + 6.5, { width: dayColWidth, align: "center" });
        } else {
          doc
            .fillColor(C_RED)
            .font("ZapfDingbats")
            .fontSize(9)
            .text("8", x, cursorY + 6.5, { width: dayColWidth, align: "center" });
        }

        doc
          .moveTo(x, cursorY)
          .lineTo(x, cursorY + 18)
          .strokeColor(C_BORDER)
          .lineWidth(0.5)
          .stroke();
      });

      // Borders
      doc
        .moveTo(MARGIN_X + totalTableWidth, cursorY)
        .lineTo(MARGIN_X + totalTableWidth, cursorY + 18)
        .strokeColor(C_BORDER)
        .lineWidth(0.5)
        .stroke();

      doc
        .moveTo(MARGIN_X, cursorY)
        .lineTo(MARGIN_X, cursorY + 18)
        .strokeColor(C_BORDER)
        .lineWidth(0.5)
        .stroke();

      cursorY += 18;
      rowIdx++;
    }
  }

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
};
