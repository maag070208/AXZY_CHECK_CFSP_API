import { resend, transporter } from "../config/mail";
import { prismaClient as prisma } from "../config/database";
import { logger } from "./logger";

/** Adjunto de evidencia (URL + tipo) tal como llega del reporte. */
interface IEmailMedia {
  url?: string;
  type?: string;
}

/** Datos mínimos de una incidencia para el correo. */
interface IIncidentEmailData {
  id?: string;
  title: string;
  description?: string | null;
  /** Campo `Json?` de Prisma: se normaliza dentro de la función. */
  media?: unknown;
  category?: { name?: string; value?: string } | null;
}

/** Datos mínimos de un mantenimiento para el correo. */
interface IMaintenanceEmailData {
  title: string;
  description?: string | null;
  /** Campo `Json?` de Prisma: se normaliza dentro de la función. */
  media?: unknown;
  type?: { name?: string; value?: string } | null;
  categoryRel?: { name?: string; value?: string } | null;
  category?: string | null;
}

/** Persona que reporta (guardia). */
interface IEmailReporter {
  name: string;
  lastName?: string | null;
}

export const sendIncidentEmail = async (incident: IIncidentEmailData, guard: IEmailReporter) => {
  try {
  // En pruebas no se envían notificaciones externas (Resend/WhatsApp): son
  // llamadas de red reales y hacían la suite lenta e intermitente.
  if (process.env.NODE_ENV === "test") return;

    // 1. Get recipients from SysConfig
    const config = await prisma.sysConfig.findUnique({
      where: { key: "INCIDENT_EMAIL" },
    });

    if (!config || !config.value) {
      logger.warn("No Recipients found for INCIDENT_EMAIL");
      return;
    }

    const recipients = config.value.split("|");

    const subject = `⚠️ Nuevo Incidente Reportado: ${incident.title}`;

    // 2. Prepare Media Links
    let mediaLinks = "<p><em>No hay evidencia adjunta.</em></p>";
    const incidentMedia = Array.isArray(incident.media)
      ? (incident.media as IEmailMedia[])
      : [];
    if (incidentMedia.length > 0) {
      mediaLinks = "<ul>";
      incidentMedia.forEach((m) => {
        const url = m.url;
        const type = m.type === "VIDEO" ? "Video" : "Foto";
        mediaLinks += `<li><a href="${url}" target="_blank">${type} - Ver evidencia</a></li>`;
      });
      mediaLinks += "</ul>";
    }

    // 3. Prepare Email Content with improved design
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #d9534f; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Nuevo Incidente Reportado</h2>
        </div>
        
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Se ha reportado una nueva incidencia en el sistema. A continuación se detallan los datos registrados por el guardia.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; width: 30%; font-weight: bold; color: #555;">Guardia:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${guard.name} ${guard.lastName || ""}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Fecha:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Título:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${incident.title}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Categoría:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">
                <span style="background-color: #fce4ec; color: #c2185b; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                  ${incident.category?.name || "Sin categoría"}
                </span>
              </td>
            </tr>
          </table>

          <div style="margin-bottom: 25px;">
            <h3 style="color: #d9534f; border-bottom: 2px solid #d9534f; padding-bottom: 5px; margin-bottom: 15px;">Descripción</h3>
            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #d9534f; margin: 0; font-style: italic; color: #555;">
              ${incident.description || "Sin descripción"}
            </blockquote>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #d9534f; border-bottom: 2px solid #d9534f; padding-bottom: 5px; margin-bottom: 15px;">Evidencias Adjuntas</h3>
            ${mediaLinks}
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
             <a href="${process.env.SYSTEM_URL || "https://axzycheckui-production.up.railway.app/#/home"}" style="background-color: #333; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Ir al Panel de Control</a>
          </div>
        </div>
        
        <div style="background-color: #fcfcfc; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 0;">Este es un mensaje automático del sistema de recorridos y seguridad.</p>
        </div>
      </div>
    `;

    // 4. Send Email
    logger.debug("Sending email using Resend");
    if (resend) {
      const { data, error } = await resend.emails.send({
        from: "AXZY Check <noreply@axzy.dev>",
        to: recipients,
        subject: subject,
        html: htmlContent,
      });
      if (error) {
        logger.error("Resend Error:", error);
      } else {
        logger.info("Resend Success:", data);
      }
    } else {
      await transporter.sendMail({
        from: "aamaro@axzy.dev",
        to: recipients,
        subject: subject,
        html: htmlContent,
      });
    }

    logger.info(`Incident email sent to ${recipients.join(", ")}`);
  } catch (error) {
    logger.error("Error sending incident email:", error);
  }
};

export const sendMaintenanceEmail = async (maintenance: IMaintenanceEmailData, guard: IEmailReporter) => {
  try {
  // En pruebas no se envían notificaciones externas (Resend/WhatsApp): son
  // llamadas de red reales y hacían la suite lenta e intermitente.
  if (process.env.NODE_ENV === "test") return;

    const config = await prisma.sysConfig.findUnique({
      where: { key: "MAINTENANCE_EMAIL" },
    });

    if (!config || !config.value) {
      logger.warn("No Recipients found for MAINTENANCE_EMAIL");
      return;
    }

    const recipients = config.value.split("|");
    const subject = `🔧 Nuevo Reporte de Mantenimiento: ${maintenance.title}`;

    let mediaLinks = "<p><em>No hay evidencia adjunta.</em></p>";
    const maintenanceMedia = Array.isArray(maintenance.media)
      ? (maintenance.media as IEmailMedia[])
      : [];
    if (maintenanceMedia.length > 0) {
      mediaLinks = "<ul>";
      maintenanceMedia.forEach((m) => {
        const url = m.url;
        const type = m.type === "VIDEO" ? "Video" : "Foto";
        mediaLinks += `<li><a href="${url}" target="_blank">${type} - Ver evidencia</a></li>`;
      });
      mediaLinks += "</ul>";
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #f0ad4e; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">🔧 Nuevo Reporte de Mantenimiento</h2>
        </div>
        
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Se ha reportado un nuevo mantenimiento en el sistema. A continuación se detallan los datos registrados.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; width: 30%; font-weight: bold; color: #555;">Reporta:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${guard.name} ${guard.lastName || ""}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Fecha:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Tipo:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${maintenance.type?.name || maintenance.title}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Categoría:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${maintenance.categoryRel?.name || maintenance.category || "Mantenimiento General"}</td>
            </tr>
          </table>

          <div style="margin-bottom: 25px;">
            <h3 style="color: #f0ad4e; border-bottom: 2px solid #f0ad4e; padding-bottom: 5px; margin-bottom: 15px;">Descripción</h3>
            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #f0ad4e; margin: 0; font-style: italic; color: #555;">
              ${maintenance.description || "Sin descripción"}
            </blockquote>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #f0ad4e; border-bottom: 2px solid #f0ad4e; padding-bottom: 5px; margin-bottom: 15px;">Evidencias Adjuntas</h3>
            ${mediaLinks}
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
             <a href="${process.env.SYSTEM_URL || "https://axzycheckui-production.up.railway.app/#/home"}" style="background-color: #333; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Ir al Panel de Control</a>
          </div>
        </div>
        
        <div style="background-color: #fcfcfc; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 0;">Este es un mensaje automático del sistema de recorridos y seguridad.</p>
        </div>
      </div>
    `;

    if (resend) {
      const { data, error } = await resend.emails.send({
        from: "AXZY Check <noreply@axzy.dev>",
        to: recipients,
        subject: subject,
        html: htmlContent,
      });
      if (error) {
        logger.error("Resend Error (Maintenance):", error);
      } else {
        logger.info("Resend Success (Maintenance):", data);
      }
    } else {
      await transporter.sendMail({
        from: "aamaro@axzy.dev",
        to: recipients,
        subject: subject,
        html: htmlContent,
      });
    }

    logger.info(`Maintenance email sent to ${recipients.join(", ")}`);
  } catch (error) {
    logger.error("Error sending maintenance email:", error);
  }
};

export const sendIncidentWhatsApp = async (incident: IIncidentEmailData, guard: IEmailReporter) => {
  try {
  // En pruebas no se envían notificaciones externas (Resend/WhatsApp): son
  // llamadas de red reales y hacían la suite lenta e intermitente.
  if (process.env.NODE_ENV === "test") return;

    const config = await prisma.sysConfig.findUnique({
      where: { key: "INCIDENT_WHATSAPP" },
    });

    if (!config || !config.value) {
      logger.warn("No Recipients found for INCIDENT_WHATSAPP");
      return;
    }

    const recipients = config.value.split("|");
    const incidentUrl = `${process.env.SYSTEM_URL || "https://axzycheckui-production.up.railway.app"}/#/incidents/${incident.id}`;
  } catch (error) {
    logger.error("Error sending incident WhatsApp:", error);
  }
};

export const sendMaintenanceWhatsApp = async (maintenance: IMaintenanceEmailData, guard: IEmailReporter) => {
  try {
  // En pruebas no se envían notificaciones externas (Resend/WhatsApp): son
  // llamadas de red reales y hacían la suite lenta e intermitente.
  if (process.env.NODE_ENV === "test") return;

    const config = await prisma.sysConfig.findUnique({
      where: { key: "MAINTENANCE_WHATSAPP" },
    });

    if (!config || !config.value) {
      logger.warn("No Recipients found for MAINTENANCE_WHATSAPP");
      return;
    }

    const recipients = config.value.split("|");

    for (const to of recipients) {
      // Note: Using a generic approach for maintenance if no specific template exists yet
      logger.debug(`Sending maintenance WhatsApp to ${to} (Infobip)`);
      // await WhatsAppService.sendTemplateMessage(to, MaintenanceReportTemplate, ...);
    }
  } catch (error) {
    logger.error("Error sending maintenance WhatsApp:", error);
  }
};
