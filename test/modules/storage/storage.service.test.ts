import { StorageService } from "@src/modules/storage/storage.service";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/lib-storage");
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://signed-url.com"),
}));

describe("StorageService (Unit Test)", () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService();
    jest.clearAllMocks();
  });

  it("debe subir un buffer exitosamente", async () => {
    const mockUploadDone = jest.fn().mockResolvedValue({});
    (Upload as unknown as jest.Mock).mockImplementation(() => ({
      done: mockUploadDone,
    }));

    const result = await storageService.uploadBuffer(
      Buffer.from("hello"),
      "my-bucket",
      "test.txt"
    );

    expect(result).toEqual({ bucket: "my-bucket", key: "test.txt" });
    expect(Upload).toHaveBeenCalled();
    expect(mockUploadDone).toHaveBeenCalled();
  });

  it("debe generar una URL firmada", async () => {
    const url = await storageService.getSignedReadUrl("my-bucket", "test.txt");
    expect(url).toBe("https://signed-url.com");
  });

  it("debe eliminar un archivo", async () => {
    const mockSend = jest.fn().mockResolvedValue({});
    // @ts-ignore
    storageService["client"].send = mockSend;

    await storageService.deleteFile("my-bucket", "test.txt");

    expect(mockSend).toHaveBeenCalled();
  });
});
