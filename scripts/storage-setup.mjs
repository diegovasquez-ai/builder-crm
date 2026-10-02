// Prepara el bucket de documentos y comprueba que funciona.
//
//   node scripts/storage-setup.mjs [--origins https://crm.tu-dominio.com,http://localhost:3000]
//
// 1. Lee S3_* de .env.local.
// 2. Pone la regla CORS del bucket (PUT/GET desde los origenes del CRM) — sin esto el
//    navegador no puede subir directo. Con --origins se agregan a los de APP_BASE_URL.
// 3. Ida y vuelta: sube un objeto chico, lo lee con URL firmada, lo borra.
//
// Sirve igual para R2, MinIO, Garage o Supabase Storage: es todo protocolo S3.

import { config } from "dotenv";
import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

config({ path: ".env.local", quiet: true });

const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  console.error("Faltan S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY en .env.local");
  process.exit(1);
}

const argOrigins = (() => {
  const i = process.argv.indexOf("--origins");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1].split(",") : [];
})();
const origins = [
  ...new Set(
    [process.env.APP_BASE_URL, "http://localhost:3000", ...argOrigins]
      .filter(Boolean)
      .map((o) => o.replace(/\/$/, ""))
  ),
];

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

async function main() {
  console.log(`Bucket: ${S3_BUCKET} @ ${S3_ENDPOINT}`);

  // --- CORS ---
  console.log(`>>> CORS para: ${origins.join(", ")}`);
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["content-type"],
            ExposeHeaders: ["etag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  const cors = await s3.send(new GetBucketCorsCommand({ Bucket: S3_BUCKET }));
  console.log("    ok:", JSON.stringify(cors.CORSRules?.[0]?.AllowedOrigins));

  // --- Ida y vuelta ---
  const key = `_healthcheck/${Date.now()}.txt`;
  console.log(`>>> Subiendo ${key} ...`);
  await s3.send(
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: "builder crm ok", ContentType: "text/plain" })
  );
  const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  console.log(`    ok (${head.ContentLength} bytes)`);

  console.log(">>> URL firmada de lectura ...");
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), {
    expiresIn: 60,
  });
  const res = await fetch(url);
  const text = await res.text();
  console.log(`    HTTP ${res.status}: "${text}"`);
  if (!res.ok || text !== "builder crm ok") throw new Error("La lectura firmada no devolvio lo esperado");

  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  console.log(">>> Borrado. Todo en orden.");
}

main().catch((err) => {
  console.error("Fallo:", err.name, err.message);
  process.exitCode = 1;
});
