import { Request, Response } from "express";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { StorageService } from "../storage/storage.service";
import { prismaClient as prisma } from "@src/core/config/database";
import { logger } from "@src/core/utils/logger";

const storageService = new StorageService();

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json(createTResult(null, ["No file uploaded"]));
    }

    const bucketName = process.env.AWS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("Storage bucket name not configured");
    }

    const user = res.locals.user;
    const roundId = req.body.roundId;
    const locationName = req.body.location || "unknown";

    // Fetch full user data to get client and schedule names
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { client: true, schedule: true },
    });

    const clientName = dbUser?.client?.name || "Sin_Cliente";
    const guardName = dbUser?.username || dbUser?.name || "Sin_Guardia";
    const scheduleName = dbUser?.schedule?.name || "Sin_Turno";

    // Determine subfolder and if it's a round
    let subfolder = "rondas";
    let isRound = true;

    if (locationName.toLowerCase() === "incident") {
      subfolder = "incidencias";
      isRound = false;
    } else if (locationName.toLowerCase() === "maintenance") {
      subfolder = "mantenimiento";
      isRound = false;
    }

    // Format: YYYYMMDDHHmmss
    const now = new Date();
    const dateStr = now
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);

    // Sanitize strings
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "_");

    const sClient = sanitize(clientName);
    const sGuard = sanitize(guardName);
    const sTurn = sanitize(scheduleName);
    const sLoc = sanitize(locationName);
    const sRound = roundId ? sanitize(roundId) : null;

    const ext = req.file.originalname.split(".").pop() || "jpg";

    // Convention: cliente_guardia_turno_ubicacion_[iddelaronda]_fecha.ext
    // Only include roundId if it's a round and we have it
    let filenameParts = [sClient, sGuard, sTurn, sLoc];
    if (isRound && sRound) {
      filenameParts.push(sRound);
    }
    filenameParts.push(dateStr);

    const finalName = `${filenameParts.join("_")}.${ext}`;

    // Folder structure: client_name/subfolder/filename
    const key = `${sClient}/${subfolder}/${finalName}`;

    const result = await storageService.uploadFile(req.file, bucketName, key);

    // AWS S3 Public URL format: https://bucket.s3.region.amazonaws.com/key
    const region = process.env.AWS_REGION || "us-east-2";
    const fullUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    // Return the URL and metadata
    return res.status(200).json(
      createTResult({
        url: fullUrl,
        type: req.file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE",
        mimetype: req.file.mimetype,
        size: req.file.size,
        bucket: result.bucket,
        key: result.key,
      }),
    );
  } catch (error: any) {
    logger.error("Upload error:", error);
    return res.status(500).json(createTResult(null, error.message));
  }
};
