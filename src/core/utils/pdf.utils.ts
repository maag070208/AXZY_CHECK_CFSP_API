import PDFDocument from "pdfkit";
import { prismaClient as prisma } from "@src/core/config/database";

export const drawTrialWatermark = async (doc: any, pageWidth: number, pageHeight: number) => {
  const config = await prisma.subscriptionConfig.findFirst({ select: { paid: true, trialDaysRemaining: true, showTrialWatermark: true, showTrialBadge: true } });
  if (!config || config.paid) return;

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);

    if (config.showTrialWatermark) {
      doc.save();
      doc.opacity(0.12);
      doc.font("Helvetica-Bold").fontSize(80).fillColor("#EF4444");
      doc.translate(pageWidth / 2, pageHeight / 2);
      doc.rotate(-45, { origin: [0, 0] });
      doc.text("MODO PRUEBA", -250, -40, { width: 500, align: "center" });
      doc.restore();
    }

    if (config.showTrialBadge) {
      doc.save();
      doc.opacity(1);
      doc.rect(pageWidth - 140, pageHeight - 30, 130, 20).fillColor("#EF4444").fill();
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7).text(
        `${config.trialDaysRemaining} días de prueba restantes`,
        pageWidth - 140, pageHeight - 24,
        { width: 130, align: "center" },
      );
      doc.restore();
    }
  }
};

export const drawGenericFooter = (
  doc: any,
  pageWidth: number,
  pageHeight: number,
  pageIdx: number,
  totalPages: number,
) => {
  const FOOTER_HEIGHT = 100;
  const startY = pageHeight - FOOTER_HEIGHT;
  const colWidth = pageWidth / 3;

  // Background
  doc.rect(0, startY, pageWidth, FOOTER_HEIGHT).fillColor("#F8FAFC").fill();
  doc.moveTo(0, startY).lineTo(pageWidth, startY).strokeColor("#E2E8F0").lineWidth(1).stroke();

  // Typography Tokens
  const C_DARK = "#1E293B";
  const C_GRAY = "#64748B";
  const C_BLUE = "#3B82F6";
  const C_PINK = "#EC4899";
  const C_SLATE = "#475569";

  // --- COL 1: Project Info ---
  let x1 = 30;
  let y1 = startY + 20;
  
  doc.fillColor(C_DARK).font("Helvetica-Bold").fontSize(12).text("CHECK Suite", x1, y1);
  y1 += 18;
  doc.fillColor(C_GRAY).font("Helvetica").fontSize(8).text(
    "Plataforma líder en control de guardias y gestión de rondas de seguridad escalables.",
    x1, y1, { width: colWidth - 40 }
  );
  doc.fillColor("#94A3B8").fontSize(7).text("© 2026 CHECK Suite", x1, startY + FOOTER_HEIGHT - 20);

  // --- COL 2: axzydev ---
  let x2 = colWidth + 20;
  let y2 = startY + 15;
  
  // Badge
  doc.rect(x2, y2, 16, 16).fillColor(C_BLUE).fill();
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text("A", x2, y2 + 4, { width: 16, align: "center" });
  
  doc.fillColor(C_DARK).font("Helvetica-Bold").fontSize(10).text("axzydev", x2 + 24, y2 + 1);
  doc.fillColor(C_BLUE).font("Helvetica-Bold").fontSize(7).text("Desarrollo de Software & UX/UI", x2 + 24, y2 + 12);
  
  y2 += 22;
  doc.fillColor(C_SLATE).font("Helvetica").fontSize(7).text(
    "Especialista en desarrollo de aplicaciones con enfoque en experiencia de usuario y arquitectura escalable.",
    x2, y2, { width: colWidth - 40 }
  );
  
  y2 += 24;
  doc.fillColor(C_GRAY).fontSize(7).text("Web: https://axzy.dev", x2, y2);
  doc.text("Email: aamaro@axzy.dev", x2, y2 + 10);

  // --- COL 3: ISST ---
  let x3 = colWidth * 2 + 10;
  let y3 = startY + 15;

  // Badge
  doc.rect(x3, y3, 16, 16).fillColor(C_PINK).fill();
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text("I", x3, y3 + 4, { width: 16, align: "center" });

  doc.fillColor(C_DARK).font("Helvetica-Bold").fontSize(10).text("ISST", x3 + 24, y3 + 1);
  doc.fillColor(C_PINK).font("Helvetica-Bold").fontSize(7).text("Ingeniería en Sistemas", x3 + 24, y3 + 12);

  y3 += 22;
  doc.fillColor(C_SLATE).font("Helvetica").fontSize(7).text(
    "Empresa especializada en desarrollo de soluciones tecnológicas empresariales, consultoría IT e implementación.",
    x3, y3, { width: colWidth - 40 }
  );

  y3 += 24;
  doc.fillColor(C_GRAY).fontSize(7).text("Web: https://isstech.mx", x3, y3);
  doc.text("Email: ingenieria@isst.mx", x3, y3 + 10);

  // Page Numbers
  doc.fillColor(C_SLATE).font("Helvetica-Bold").fontSize(8).text(
    `PÁGINA ${pageIdx} DE ${totalPages}`,
    0, startY + FOOTER_HEIGHT - 20, { align: "right", width: pageWidth - 30 }
  );
};
