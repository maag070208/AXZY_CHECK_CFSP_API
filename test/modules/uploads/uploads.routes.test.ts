import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_ADMIN } from "@src/core/config/constants";
import { StorageService } from "@src/modules/storage/storage.service";

jest.mock("@src/modules/common/middlewares/auth.middleware", () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers["user"]) {
      const user = JSON.parse(req.headers["user"]);
      req.user = user;
      res.locals.user = user;
    }
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

/**
 * Mock SOLO del servicio de storage (S3).
 *
 * Motivo: `StorageService.uploadFile` hace una subida multipart real contra AWS S3,
 * que requiere credenciales y red (lento/flaky en la base local de pruebas).
 * El resto del endpoint queda 100% real: multer (campo "file" y filtro de mime),
 * el armado de la key en `upload.controller`, la lectura real del usuario en Postgres
 * y la construcción de la URL pública.
 *
 * `StorageService.__uploadFile` expone el doble para afirmar con qué bucket/key se llamó.
 */
jest.mock("@src/modules/storage/storage.service", () => {
  const uploadFile = jest
    .fn()
    .mockImplementation(async (_file: any, bucketName: string, key: string) => ({
      bucket: bucketName,
      key,
    }));

  const StorageService = jest.fn().mockImplementation(() => ({
    uploadFile,
    uploadBuffer: jest.fn(),
    getSignedReadUrl: jest.fn(),
    deleteFile: jest.fn(),
  }));

  (StorageService as unknown as { __uploadFile: jest.Mock }).__uploadFile = uploadFile;

  return { StorageService };
});

jest.setTimeout(30000);

const uploadFileMock = () =>
  (StorageService as unknown as { __uploadFile: jest.Mock }).__uploadFile;

describe("Rutas de Uploads (Integración)", () => {
  // Se leen del entorno de pruebas (.env.test) para que coincidan SIEMPRE con lo
  // que usa el controlador y nunca apunten al bucket de producción.
  const bucketName = process.env.AWS_BUCKET_NAME || "checkapp-test-bucket";
  const region = process.env.AWS_REGION || "us-east-2";

  let adminUserId: string;
  let username: string;
  let originalBucket: string | undefined;
  let originalRegion: string | undefined;

  const adminHeader = () => JSON.stringify({ id: adminUserId, role: ROLE_ADMIN });

  beforeAll(async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: ROLE_ADMIN } });

    username = `admin_uploads_${Date.now()}`;
    const admin = await prismaClient.user.create({
      data: {
        name: "Admin",
        lastName: "Uploads",
        username,
        password: "hashed",
        roleId: adminRole!.id,
      },
    });
    adminUserId = admin.id;

    // El controller arma la URL pública con estas variables: se fijan para que la
    // aserción no dependa del .env local (que apunta a producción).
    originalBucket = process.env.AWS_BUCKET_NAME;
    originalRegion = process.env.AWS_REGION;
    process.env.AWS_BUCKET_NAME = bucketName;
    process.env.AWS_REGION = region;
  });

  afterAll(async () => {
    if (originalBucket === undefined) delete process.env.AWS_BUCKET_NAME;
    else process.env.AWS_BUCKET_NAME = originalBucket;

    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;

    if (adminUserId) {
      // El endpoint de subida registra auditoría (UPLOADS/UPLOAD): se limpia antes del usuario.
      await prismaClient.auditLog.deleteMany({ where: { userId: adminUserId } }).catch(() => {});
      await prismaClient.user.delete({ where: { id: adminUserId } }).catch(() => {});
    }
  });

  it("debe subir una imagen de ronda y devolver la URL pública construida", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

    const response = await request(app)
      .post("/api/v1/uploads")
      .set("user", adminHeader())
      .field("location", "Puerta Principal")
      .field("roundId", "ronda-abc")
      .attach("file", png, { filename: "foto.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messages).toEqual(["Success"]);

    const data = response.body.data;
    // El nombre sale del usuario REAL leído de Postgres (Prisma no está mockeado).
    expect(data.key.startsWith("Sin_Cliente/rondas/")).toBe(true);
    expect(data.key).toContain(username);
    expect(data.key).toContain("Puerta_Principal");
    expect(data.key).toContain("ronda_abc");
    expect(data.key.endsWith(".png")).toBe(true);

    expect(data.type).toBe("IMAGE");
    expect(data.mimetype).toBe("image/png");
    expect(data.size).toBe(png.length);
    expect(data.bucket).toBe(bucketName);
    expect(data.url).toBe(`https://${bucketName}.s3.${region}.amazonaws.com/${data.key}`);

    // El servicio de storage recibió (archivo, bucket, key calculada).
    const uploadFile = uploadFileMock();
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile.mock.calls[0][1]).toBe(bucketName);
    expect(uploadFile.mock.calls[0][2]).toBe(data.key);
  });

  it("debe clasificar un video como VIDEO", async () => {
    const mp4 = Buffer.from("00000018667479706d703432", "hex");

    const response = await request(app)
      .post("/api/v1/uploads")
      .set("user", adminHeader())
      .field("location", "Porteria")
      .attach("file", mp4, { filename: "clip.mp4", contentType: "video/mp4" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.type).toBe("VIDEO");
    expect(response.body.data.mimetype).toBe("video/mp4");
    expect(response.body.data.key).toContain("/rondas/");
    expect(response.body.data.key.endsWith(".mp4")).toBe(true);
  });

  it("debe usar la subcarpeta incidencias y omitir el id de ronda", async () => {
    const jpg = Buffer.from("ffd8ffe000104a464946000101", "hex");

    const response = await request(app)
      .post("/api/v1/uploads")
      .set("user", adminHeader())
      .field("location", "incident")
      .field("roundId", "ronda-que-no-debe-aparecer")
      .attach("file", jpg, { filename: "incidencia.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.key).toContain("/incidencias/");
    expect(response.body.data.key).not.toContain("ronda_que_no_debe_aparecer");
  });

  it("debe devolver 400 cuando no se envía archivo", async () => {
    const response = await request(app)
      .post("/api/v1/uploads")
      .set("user", adminHeader())
      .field("location", "Puerta Principal");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeNull();
    expect(response.body.messages).toEqual(["No file uploaded"]);
  });

  it("debe rechazar con 415 un tipo de archivo no permitido", async () => {
    const response = await request(app)
      .post("/api/v1/uploads")
      .set("user", adminHeader())
      .field("location", "Puerta Principal")
      .attach("file", Buffer.from("hola"), { filename: "notas.txt", contentType: "text/plain" });

    expect(response.status).toBe(415);
    expect(response.body.success).toBe(false);
    expect(response.body.data).toBeNull();
    expect(response.body.messages).toEqual([
      "Tipo de archivo inválido. Solo se permiten imágenes y videos.",
    ]);
  });

  it("debe devolver 404 en una ruta de uploads inexistente", async () => {
    const response = await request(app)
      .post("/api/v1/uploads/no-existe")
      .set("user", adminHeader());

    expect(response.status).toBe(404);
  });
});
