import type { NextRequest } from "next/server";
import { zernio } from "@/lib/channels/conectores/zernio";
import { manejarWebhook, barrerWebhook } from "@/lib/channels/webhook";

/**
 * Webhook de Zernio (WhatsApp, Instagram DM y Messenger). Toda la mecanica (firma,
 * idempotencia, after(), barrido) es generica y vive en src/lib/channels/webhook.ts;
 * lo propio de Zernio esta en el conector.
 *
 * Esta URL es la registrada en Zernio (`npm run zernio:webhook -- --url ...`): no
 * cambiarla. Publica por el prefijo /api/webhooks (supabase/middleware.ts).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest) => manejarWebhook(zernio, request);
export const GET = (request: NextRequest) => barrerWebhook(zernio, request);
