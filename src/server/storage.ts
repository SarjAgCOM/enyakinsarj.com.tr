import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";
import { slugify } from "@/lib/slug";

/**
 * Oracle Cloud Infrastructure Object Storage — S3 uyumluluk API'si.
 * Endpoint: https://{namespace}.compat.objectstorage.{region}.oraclecloud.com
 * Kimlik: OCI Konsol → Profil → "Customer Secret Keys" (Access Key / Secret Key).
 */

let client: S3Client | undefined;

function config() {
  const e = env();
  if (!e.OCI_NAMESPACE || !e.OCI_BUCKET || !e.OCI_ACCESS_KEY_ID || !e.OCI_SECRET_ACCESS_KEY) {
    throw new Error("Oracle bucket ayarları eksik: OCI_NAMESPACE, OCI_BUCKET, OCI_ACCESS_KEY_ID, OCI_SECRET_ACCESS_KEY");
  }
  return e as typeof e & { OCI_NAMESPACE: string; OCI_BUCKET: string; OCI_ACCESS_KEY_ID: string; OCI_SECRET_ACCESS_KEY: string };
}

export function isStorageConfigured() {
  const e = env();
  return Boolean(e.OCI_NAMESPACE && e.OCI_BUCKET && e.OCI_ACCESS_KEY_ID && e.OCI_SECRET_ACCESS_KEY);
}

function s3() {
  if (client) return client;
  const c = config();
  client = new S3Client({
    region: c.OCI_REGION,
    endpoint: `https://${c.OCI_NAMESPACE}.compat.objectstorage.${c.OCI_REGION}.oraclecloud.com`,
    forcePathStyle: true,
    credentials: { accessKeyId: c.OCI_ACCESS_KEY_ID, secretAccessKey: c.OCI_SECRET_ACCESS_KEY },
    // OCI S3 uyumluluk katmanı yeni varsayılan checksum başlıklarını desteklemeyebilir
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export function publicUrl(key: string) {
  const c = config();
  const base =
    c.OCI_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
    `https://objectstorage.${c.OCI_REGION}.oraclecloud.com/n/${c.OCI_NAMESPACE}/b/${c.OCI_BUCKET}/o`;
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function uploadObject(file: { name: string; type: string; bytes: Uint8Array }, folder = "uploads") {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error(`Desteklenmeyen dosya türü: ${file.type}`);
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("Dosya 10 MB'tan büyük olamaz");
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, ""), 60) || "gorsel";
  const now = new Date();
  const key = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${base}-${randomUUID().slice(0, 8)}.${ext}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: config().OCI_BUCKET,
      Key: key,
      Body: file.bytes,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { key, url: publicUrl(key) };
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: config().OCI_BUCKET, Key: key }));
}
