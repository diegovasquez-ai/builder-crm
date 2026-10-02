import crypto from "node:crypto";
import { normalizePhone } from "@/lib/phone";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";

const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

// La fuente unica de normalizePhone esta en phone.ts; re-export por compatibilidad.
export { normalizePhone };

/**
 * Credenciales de envio que se pasan a las funciones de envio. `accessToken` puede
 * venir null (cuenta sin token cargado); en ese caso se usa el fallback de env.
 */
export interface WhatsappSendCredentials {
  phoneNumberId: string;
  accessToken: string | null;
}

interface ResolvedCreds {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Resuelve credenciales de envio: usa las de la cuenta (multi-tenant) o cae a las
 * env globales (fallback de transicion para no romper el flujo single-tenant).
 */
function resolveCreds(
  account?: WhatsappSendCredentials | null
): ResolvedCreds | null {
  if (account?.phoneNumberId && account.accessToken) {
    return {
      phoneNumberId: account.phoneNumberId,
      accessToken: account.accessToken,
    };
  }
  if (PHONE_NUMBER_ID && ACCESS_TOKEN) {
    console.warn(
      "[meta-whatsapp] sin cuenta resuelta, usando credenciales de env (fallback)"
    );
    return { phoneNumberId: PHONE_NUMBER_ID, accessToken: ACCESS_TOKEN };
  }
  return null;
}

interface MetaError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  error_data?: { details?: string };
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: MetaError;
  rawResponse?: unknown;
}

export async function sendTextMessage(
  account: WhatsappSendCredentials | null,
  to: string,
  body: string
): Promise<SendResult> {
  const creds = resolveCreds(account);
  if (!creds) {
    return {
      success: false,
      error: { message: "Sin credenciales de WhatsApp (ni cuenta ni env)" },
    };
  }

  const url = `${GRAPH_BASE}/${creds.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    type: "text",
    text: { preview_url: false, body },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      return { success: false, error: json.error, rawResponse: json };
    }

    const messageId = json.messages?.[0]?.id;
    return { success: true, messageId, rawResponse: json };
  } catch (err) {
    return {
      success: false,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}

export async function sendTemplateMessage(
  account: WhatsappSendCredentials | null,
  to: string,
  templateName: string,
  language = "es",
  components: unknown[] = []
): Promise<SendResult> {
  const creds = resolveCreds(account);
  if (!creds) {
    return {
      success: false,
      error: { message: "Sin credenciales de WhatsApp (ni cuenta ni env)" },
    };
  }

  const url = `${GRAPH_BASE}/${creds.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      return { success: false, error: json.error, rawResponse: json };
    }

    const messageId = json.messages?.[0]?.id;
    return { success: true, messageId, rawResponse: json };
  } catch (err) {
    return {
      success: false,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}

export interface CreateTemplatePayload {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: unknown[];
}

/**
 * Credenciales para operar plantillas. Las plantillas viven en el WABA (no en el
 * phone number), por eso esto pide `wabaId` en vez de `phoneNumberId`. La interfaz
 * `WhatsappAccount` (whatsapp-accounts.ts) es asignable a esto.
 */
export interface WhatsappTemplateCredentials {
  wabaId: string | null;
  accessToken: string | null;
}

interface ResolvedWabaCreds {
  wabaId: string;
  accessToken: string;
}

/** Resuelve WABA + token: prioriza la cuenta multi-tenant, cae a env (transicion). */
function resolveWabaCreds(
  account?: WhatsappTemplateCredentials | null
): ResolvedWabaCreds | null {
  if (account?.wabaId && account.accessToken) {
    return { wabaId: account.wabaId, accessToken: account.accessToken };
  }
  if (WABA_ID && ACCESS_TOKEN) {
    console.warn(
      "[meta-whatsapp] sin cuenta resuelta para plantillas, usando env (fallback)"
    );
    return { wabaId: WABA_ID, accessToken: ACCESS_TOKEN };
  }
  return null;
}

export async function createTemplate(
  account: WhatsappTemplateCredentials | null,
  payload: CreateTemplatePayload
): Promise<SendResult & { templateId?: string; status?: string }> {
  const creds = resolveWabaCreds(account);
  if (!creds) {
    return {
      success: false,
      error: { message: "Sin WABA/token para crear plantilla (ni cuenta ni env)" },
    };
  }

  const url = `${GRAPH_BASE}/${creds.wabaId}/message_templates`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      return { success: false, error: json.error, rawResponse: json };
    }

    return { success: true, templateId: json.id, status: json.status, rawResponse: json };
  } catch (err) {
    return {
      success: false,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown[];
}

export async function getTemplates(
  account: WhatsappTemplateCredentials | null
): Promise<{
  success: boolean;
  templates?: MetaTemplate[];
  error?: MetaError;
}> {
  const creds = resolveWabaCreds(account);
  if (!creds) {
    return {
      success: false,
      error: { message: "Sin WABA/token para listar plantillas (ni cuenta ni env)" },
    };
  }

  const url = `${GRAPH_BASE}/${creds.wabaId}/message_templates?fields=id,name,language,status,category,components&limit=200`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    const json = await res.json();
    if (!res.ok || json.error) return { success: false, error: json.error };
    return { success: true, templates: (json.data || []) as MetaTemplate[] };
  } catch (err) {
    return {
      success: false,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}

/**
 * Valida la firma X-Hub-Signature-256 que Meta envia con cada webhook.
 * El formato del header es "sha256=<hex>".
 *
 * Si APP_SECRET no esta seteado, retorna `false` y loguea un warning. NUNCA
 * dejar que pase un webhook sin firma valida en produccion — atacante podria
 * inyectar mensajes/leads falsos.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!APP_SECRET) {
    console.warn("[meta-whatsapp] WHATSAPP_APP_SECRET no configurado — firma no validada");
    return false;
  }
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("hex");

  const provided = signatureHeader.replace(/^sha256=/, "");

  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch {
    return false;
  }
}

export const metaConfig = {
  apiVersion: API_VERSION,
  phoneNumberId: PHONE_NUMBER_ID,
  wabaId: WABA_ID,
  hasAccessToken: Boolean(ACCESS_TOKEN),
  hasAppSecret: Boolean(APP_SECRET),
};
