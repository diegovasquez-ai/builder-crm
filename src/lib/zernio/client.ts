import type { ZernioError, ZernioResult } from "./types";

/**
 * Nucleo del cliente HTTP de Zernio.
 *
 * Sigue la convencion de los otros integradores del repo (meta-whatsapp.ts, ghl.ts,
 * tokko.ts): `fetch` a mano y NUNCA lanza. Todo error vuelve como
 * `{ success: false, error }` para que el llamador no tenga que envolver en try/catch.
 */

const API_BASE = process.env.ZERNIO_API_BASE || "https://zernio.com/api/v1";
const API_KEY = process.env.ZERNIO_API_KEY || "";
const PROFILE_ID = process.env.ZERNIO_PROFILE_ID || "";

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRIABLE_STATUS = new Set([429, 502, 503, 504]);

export function hasZernioKey(): boolean {
  return API_KEY.length > 0;
}

export function getProfileId(): string | null {
  return PROFILE_ID || null;
}

export interface ZernioFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  /** Desactiva el reintento (util en handlers con presupuesto de tiempo ajustado). */
  noRetry?: boolean;
  /**
   * Headers extra. El caso principal es `Idempotency-Key`: Zernio replica la respuesta
   * original en vez de mandar el mensaje dos veces si reintentamos tras un timeout.
   */
  headers?: Record<string, string>;
}

export async function zernioFetch<T>(
  path: string,
  options: ZernioFetchOptions = {}
): Promise<ZernioResult<T>> {
  if (!API_KEY) {
    return fail(0, "ZERNIO_API_KEY no configurada");
  }

  const url = buildUrl(path, options.query);
  const { method = "GET", body, timeoutMs = TIMEOUT_MS } = options;
  const maxAttempts = options.noRetry ? 1 : MAX_RETRIES + 1;

  let last: ZernioError = { status: 0, message: "Sin intentos" };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await attemptFetch<T>(
      url,
      method,
      body,
      timeoutMs,
      options.headers
    );
    if (result.success) return result;

    last = result.error;
    const isLast = attempt === maxAttempts - 1;
    if (isLast || !isRetriable(last)) return result;

    await sleep(backoffMs(attempt, last.retryAfter));
  }

  return { success: false, error: last };
}

async function attemptFetch<T>(
  url: string,
  method: string,
  body: unknown,
  timeoutMs: number,
  extraHeaders?: Record<string, string>
): Promise<ZernioResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const raw = await res.text();
    const parsed = raw ? safeJsonParse(raw) : null;

    if (!res.ok) {
      return {
        success: false,
        error: {
          status: res.status,
          code: extractString(parsed, "code"),
          message:
            extractString(parsed, "message") ??
            extractString(parsed, "error") ??
            `HTTP ${res.status}`,
          retryAfter: parseRetryAfter(res.headers.get("retry-after")),
          raw: parsed ?? raw,
        },
      };
    }

    return { success: true, data: (parsed ?? {}) as T };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      success: false,
      error: {
        // 408 marca el timeout como retriable sin inventar un status del servidor.
        status: isTimeout ? 408 : 0,
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

function buildUrl(
  path: string,
  query?: ZernioFetchOptions["query"]
): string {
  const base = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function isRetriable(error: ZernioError): boolean {
  return RETRIABLE_STATUS.has(error.status) || error.status === 408;
}

/** Backoff exponencial con jitter; respeta Retry-After si Zernio lo manda. */
function backoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 10_000);
  }
  const base = 500 * 2 ** attempt;
  return base + Math.floor(Math.random() * 250);
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === "string" ? found : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(status: number, message: string): { success: false; error: ZernioError } {
  return { success: false, error: { status, message } };
}

export const zernioConfig = {
  hasApiKey: hasZernioKey(),
  apiBase: API_BASE,
  profileId: PROFILE_ID || null,
  hasWebhookSecret: Boolean(process.env.ZERNIO_WEBHOOK_SECRET),
};
