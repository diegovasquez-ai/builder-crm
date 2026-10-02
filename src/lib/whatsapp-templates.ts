/**
 * Helpers puros para plantillas de WhatsApp (sin deps de server: se importan tanto
 * en route handlers como en componentes client).
 *
 * Dos formatos de `components` que NO hay que confundir:
 * - CREAR (Graph `POST /{WABA}/message_templates`): `{ type: "BODY", text, example }`
 * - ENVIAR (Graph `POST /{phone}/messages`): `{ type: "body", parameters: [...] }`
 */

/** Indices de variables {{1}}, {{2}}... en orden ascendente, deduplicados. */
export function extractVariables(text: string): number[] {
  const found = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(parseInt(m[1], 10));
  }
  return [...found].sort((a, b) => a - b);
}

/** true si las variables son 1..n sin huecos (lo que exige Meta). */
export function variablesAreSequential(vars: number[]): boolean {
  return vars.every((v, i) => v === i + 1);
}

/** Componente BODY para CREAR la plantilla (incluye `example` si hay variables). */
export function buildBodyComponent(
  bodyText: string,
  examples: string[]
): Record<string, unknown> {
  const vars = extractVariables(bodyText);
  const comp: Record<string, unknown> = { type: "BODY", text: bodyText };
  if (vars.length > 0) {
    comp.example = { body_text: [vars.map((v) => examples[v - 1] ?? "")] };
  }
  return comp;
}

/** Componentes para ENVIAR la plantilla, rellenando las variables del BODY. */
export function buildSendComponents(
  bodyText: string,
  values: string[]
): unknown[] {
  const vars = extractVariables(bodyText);
  if (vars.length === 0) return [];
  return [
    {
      type: "body",
      parameters: vars.map((v) => ({ type: "text", text: values[v - 1] ?? "" })),
    },
  ];
}

/**
 * Aplana los `components` de envio a un array plano de valores.
 *
 * Zernio, para ABRIR una conversacion (`POST /v1/inbox/conversations`), no toma la
 * estructura de components de Meta sino `templateParams`: un solo array con los valores
 * en el orden en que aparecen las variables (header de texto, body, y despues un valor
 * por cada boton de URL dinamica). Dentro de un hilo ya abierto si acepta components.
 */
export function flattenTemplateParams(components: unknown): string[] {
  if (!Array.isArray(components)) return [];

  const order = ["header", "body", "button"];
  const sorted = [...(components as Array<Record<string, unknown>>)].sort((a, b) => {
    const ia = order.indexOf(String(a?.type ?? "").toLowerCase());
    const ib = order.indexOf(String(b?.type ?? "").toLowerCase());
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });

  const values: string[] = [];
  for (const comp of sorted) {
    const params = comp?.parameters;
    if (!Array.isArray(params)) continue;
    for (const p of params as Array<Record<string, unknown>>) {
      if (typeof p?.text === "string") values.push(p.text);
    }
  }
  return values;
}

/** Reemplaza {{n}} por su valor; deja el placeholder si falta (para previsualizar). */
export function renderTemplateBody(bodyText: string, values: string[]): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, n: string) => {
    const idx = parseInt(n, 10) - 1;
    const v = values[idx];
    return v && v.length ? v : `{{${n}}}`;
  });
}

interface BodyLikeComponent {
  type?: string;
  text?: string;
}

/** Extrae el texto del componente BODY de una plantilla (formato Meta). */
export function getBodyText(components: unknown): string {
  if (!Array.isArray(components)) return "";
  const body = (components as BodyLikeComponent[]).find(
    (c) => typeof c?.type === "string" && c.type.toUpperCase() === "BODY"
  );
  return body?.text ?? "";
}
