import "server-only";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Bucket de archivos, por protocolo S3. Hoy apunta a Cloudflare R2; MinIO, Garage o
 * Supabase Storage son las mismas cinco variables y ningun cambio de codigo.
 *
 * El servidor NUNCA recibe el archivo: firma una URL de subida (PUT) y el navegador
 * la usa directo contra el bucket. Vercel corta los cuerpos a 4,5 MB, y ademas asi
 * un PDF de 20 MB no gasta ni un milisegundo de funcion. Para leer, igual: URL de
 * descarga firmada que vence en un minuto.
 *
 * Requiere CORS en el bucket para el origen del CRM (PUT + GET, header content-type).
 */

const ENV = {
  endpoint: process.env.S3_ENDPOINT,
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || "auto",
};

export function storageConfigured(): boolean {
  return Boolean(ENV.endpoint && ENV.bucket && ENV.accessKeyId && ENV.secretAccessKey);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!storageConfigured()) {
    throw new Error(
      "Storage sin configurar: faltan S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY"
    );
  }
  if (!client) {
    client = new S3Client({
      endpoint: ENV.endpoint,
      region: ENV.region,
      credentials: { accessKeyId: ENV.accessKeyId!, secretAccessKey: ENV.secretAccessKey! },
      // MinIO y R2 sin dominio propio van por path (bucket en la ruta, no en el host).
      forcePathStyle: true,
    });
  }
  return client;
}

const bucket = () => ENV.bucket!;

/** Lo que se acepta subir. Fuera de esto, el servidor no firma la URL. */
export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const UPLOAD_URL_TTL = 5 * 60; // segundos: tiempo para empezar el PUT, no para terminarlo
const DOWNLOAD_URL_TTL = 60;

/** URL firmada para que el navegador haga PUT del archivo con ese content-type. */
export async function signUpload(key: string, mime: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime }),
    { expiresIn: UPLOAD_URL_TTL }
  );
}

/** URL firmada de lectura. `inline` abre en el navegador (PDF/imagen); si no, descarga. */
export async function signDownload(
  key: string,
  opts: { filename: string; mime: string; inline: boolean }
): Promise<string> {
  const disposition = `${opts.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(opts.filename)}`;
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: opts.mime,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: DOWNLOAD_URL_TTL }
  );
}

/** Tamano real del objeto, o null si no existe (la subida se corto o nunca empezo). */
export async function objectSize(key: string): Promise<number | null> {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return head.ContentLength ?? 0;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Borrado en lote (al eliminar un contacto). Best-effort: un fallo no frena el resto. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  // S3 acepta hasta 1000 por llamada.
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
}

/** Nombre seguro para la clave del bucket: sin rutas, sin caracteres raros, con extension. */
export function safeFilename(name: string, mime: string): string {
  const ext = ALLOWED_MIME[mime];
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "archivo"}.${ext}`;
}
