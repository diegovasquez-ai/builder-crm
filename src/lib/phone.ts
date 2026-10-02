/**
 * Normalizacion y deteccion de identificadores de telefono para WhatsApp.
 * Centraliza el manejo de los gotchas de Coexistence (BSUID + troncal) para que
 * todo numero se guarde/compare igual en webhook y envio. Ver WHATSAPP-COEXISTENCE-BRIEF.md.
 */

/**
 * Normaliza un numero a digitos E.164 sin "+". Idempotente.
 * Corrige troncales inconsistentes que Meta envia segun pais:
 * - Argentina: el movil debe ser 549 + area + numero. Si viene 54 + 10 digitos
 *   (sin el 9), se inserta. WhatsApp siempre es movil, asi que asumimos 549.
 * - Mexico (Gotcha B del brief): 52 + 10 digitos (sin 1) -> 521 + ...
 */
export function normalizePhone(value: string): string {
  let digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  // Mexico: 52XXXXXXXXXX (12) -> 521XXXXXXXXXX (13)
  if (digits.startsWith("52") && !digits.startsWith("521") && digits.length === 12) {
    digits = "521" + digits.slice(2);
  }

  // Argentina: 54 + 10 digitos (12, sin 9) -> 549 + ... (13)
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length === 12) {
    digits = "549" + digits.slice(2);
  }

  return digits;
}

/**
 * Detecta un Business-Scoped User ID (BSUID) de Coexistence: "CC.alfanumerico"
 * (ej "MX.Ab1Cd2Ef3Gh4..."), que NO es un telefono. Gotcha A del brief.
 */
const BSUID_RE = /^[A-Z]{2}\.[A-Za-z0-9+/=_-]{10,}$/;
export function isBsuid(value: string | null | undefined): boolean {
  return BSUID_RE.test(value ?? "");
}

/**
 * Devuelve el telefono real normalizado. En Coexistence `wa_id` puede venir como
 * BSUID; en ese caso se usa `from` (messages[0].from), que SIEMPRE trae el numero
 * real. Si `wa_id` es un telefono valido, se usa ese. Gotcha A del brief.
 */
export function resolveRealPhone(
  waId: string | null | undefined,
  from: string | null | undefined
): string {
  const wa = waId ?? "";
  if (wa && !isBsuid(wa)) return normalizePhone(wa);
  return normalizePhone(from ?? "");
}
