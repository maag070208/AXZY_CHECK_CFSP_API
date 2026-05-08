import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import "multer";

export class StorageService {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  /**
   * UPLOAD FILE
   * Uses @aws-sdk/lib-storage for efficient multipart uploads
   */
  async uploadFile(
    file: Express.Multer.File,
    bucketName: string,
    customKey?: string
  ): Promise<{ bucket: string; key: string }> {
    return this.uploadBuffer(file.buffer, bucketName, customKey || `${Date.now()}_${file.originalname}`, file.mimetype);
  }

  async uploadBuffer(
    buffer: Buffer,
    bucketName: string,
    key: string,
    contentType: string = "application/octet-stream"
  ): Promise<{ bucket: string; key: string }> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
    });

    await upload.done();

    return {
      bucket: bucketName,
      key,
    };
  }

  /**
   * SIGNED URL (READ)
   * Generates a temporary link to access a private file
   */
  async getSignedReadUrl(
    bucketName: string,
    key: string,
    expiresInSeconds = 900 // 15 min
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * DELETE FILE
   */
  async deleteFile(bucketName: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await this.client.send(command);
  }
}
