import multer from "multer";
import { Request } from "express";
import path from "path";
import fs from "fs";
import { AppError } from "@src/core/errors/AppError";

// Ensure upload directory exists
// Storage configuration
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/3gpp",
    "video/webm",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // AppError (no Error plano): así el middleware central responde 415 y no 500.
    cb(new AppError("Tipo de archivo inválido. Solo se permiten imágenes y videos.", 415));
  }
};


export const fileUploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});
