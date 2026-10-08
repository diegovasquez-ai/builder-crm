import { z } from "zod";
import { modoLocal } from "@/lib/modo-local";

/**
 * Variables de entorno, validadas una sola vez y bajo demanda (no al importar: el build
 * de Next no las tiene y no debe fallar por eso).
 *
 *   const env = getEnv();          // lanza si falta algo obligatorio
 *   const faltan = envFaltantes(); // lista de nombres, para /api/health y el arranque
 *
 * Cada variable esta explicada en .env.example. Las opcionales encienden una
 * capacidad (agente, Zernio, bucket, push); sin ellas el CRM arranca igual y la UI
 * avisa que esa parte esta apagada.
 */

const vacioComoAusente = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const opcional = z.preprocess(vacioComoAusente, z.string().optional());
const booleano = z.preprocess(
  (v) => (typeof v === "string" ? ["true", "1", "si", "sí", "yes", "on"].includes(v.toLowerCase()) : v),
  z.boolean().optional()
);

export const esquemaEnv = z.object({
  // --- Obligatorias: sin esto no hay app ---
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria (Supabase -> Connect)"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL debe ser una URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria"),

  // --- App ---
  APP_BASE_URL: opcional,
  NEXT_PUBLIC_APP_URL: opcional,
  SUPABASE_SERVICE_ROLE_KEY: opcional,
  DIRECT_URL: opcional,
  ALLOW_PUBLIC_SIGNUP: booleano,
  // El servidor de autenticacion tiene SMTP: habilita invitaciones por correo y
  // "olvide mi contrasena". Ver src/lib/auth-correo.ts y docs/CORREO.md.
  AUTH_ENVIA_CORREOS: booleano,
  AGENT_WORKER_SECRET: opcional,
  LEADS_WEBHOOK_SECRET: opcional,
  SWEEP_INTERVAL_MIN: z.preprocess(vacioComoAusente, z.coerce.number().int().min(1).optional()),

  // --- Agente IA (OpenRouter) ---
  OPENROUTER_API_KEY: opcional,
  AGENT_MODEL: opcional,

  // --- Zernio (WhatsApp + Instagram + Messenger) ---
  ZERNIO_API_KEY: opcional,
  ZERNIO_PROFILE_ID: opcional,
  ZERNIO_WEBHOOK_SECRET: opcional,
  ZERNIO_API_BASE: opcional,
  WHATSAPP_PROVIDER: z.preprocess(vacioComoAusente, z.enum(["zernio", "meta"]).optional()),

  // --- Meta Cloud API directo (valvula de escape) ---
  WHATSAPP_ACCESS_TOKEN: opcional,
  WHATSAPP_PHONE_NUMBER_ID: opcional,
  WHATSAPP_BUSINESS_ACCOUNT_ID: opcional,
  WHATSAPP_APP_SECRET: opcional,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: opcional,
  WHATSAPP_API_VERSION: opcional,

  // --- Push (Web Push / VAPID) ---
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: opcional,
  VAPID_PRIVATE_KEY: opcional,
  VAPID_SUBJECT: opcional,

  // --- Documentos (bucket S3-compatible) ---
  S3_ENDPOINT: opcional,
  S3_BUCKET: opcional,
  S3_ACCESS_KEY_ID: opcional,
  S3_SECRET_ACCESS_KEY: opcional,
  S3_REGION: opcional,
});

export type Env = z.infer<typeof esquemaEnv>;

let cache: Env | null = null;

/** Devuelve el entorno validado. Lanza un solo error con todo lo que falta. */
export function getEnv(): Env {
  if (cache) return cache;
  const resultado = esquemaEnv.safeParse(process.env);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables de entorno invalidas o faltantes:\n${detalle}\nRevisa .env.example.`);
  }
  cache = resultado.data;
  return cache;
}

/** Nombres de las variables obligatorias que faltan o son invalidas (sin valores). */
/**
 * En modo local estas tres no van, y no es un descuido: la base es embebida y no hay
 * servidor de autenticacion. Si siguieran siendo obligatorias, /api/health contestaria
 * 503 para siempre y el CRM no abriria, que es justo lo que el modo local viene a
 * arreglar.
 */
const NO_HACEN_FALTA_EN_LOCAL = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

export function envFaltantes(): string[] {
  const resultado = esquemaEnv.safeParse(process.env);
  if (resultado.success) return [];
  const nombres = [...new Set(resultado.error.issues.map((i) => String(i.path[0])))];
  return modoLocal() ? nombres.filter((n) => !NO_HACEN_FALTA_EN_LOCAL.includes(n)) : nombres;
}

/** Capacidades encendidas segun el entorno. Lo usa la UI para avisar que falta. */
export function capacidades() {
  const e = process.env;
  return {
    agente: Boolean(e.OPENROUTER_API_KEY),
    zernio: Boolean(e.ZERNIO_API_KEY),
    metaDirecto: Boolean(e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID),
    push: Boolean(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY),
    documentos: Boolean(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY),
  };
}
