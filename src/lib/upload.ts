import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { AppError } from "@/lib/result";
import { randomToken } from "@/lib/crypto";

export const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg",
  "font/ttf", "font/otf", "font/woff2", "application/pdf",
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

let s3: S3Client | null = null;
function client(): S3Client {
  if (s3) return s3;
  const config = env();
  s3 = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
  });
  return s3;
}

export function validateUpload(fileName: string, mime: string, size: number): void {
  if (!ALLOWED_MIME.has(mime)) throw new AppError("INVALID_MIME", `Tipe berkas ${mime} tidak diizinkan.`, 415);
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new AppError("FILE_TOO_LARGE", "Ukuran berkas maksimal 15 MB.", 413);
  if (fileName.length > 200 || /[\\/]/.test(fileName)) throw new AppError("INVALID_FILENAME", "Nama berkas tidak valid.");
}

export interface SignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

/** Signed URL upload langsung ke S3/MinIO; server tidak pernah menerima byte file. */
export async function createSignedUpload(tenantId: string, fileName: string, mime: string, size: number): Promise<SignedUpload> {
  validateUpload(fileName, mime, size);
  const config = env();
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const key = `${tenantId}/${new Date().toISOString().slice(0, 10)}/${randomToken(12)}${extension}`;
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    ContentType: mime,
    ContentLength: size,
    Metadata: { tenantId, originalName: fileName.slice(0, 100) },
  });
  const expiresIn = 600;
  const uploadUrl = await getSignedUrl(client(), command, { expiresIn });
  return { key, uploadUrl, publicUrl: `${config.S3_PUBLIC_ENDPOINT}/${config.S3_BUCKET}/${key}`, expiresIn };
}

export async function removeObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
}
