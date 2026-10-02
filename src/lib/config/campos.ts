import type { CampoConfig } from "./schema";

/**
 * Valores de los campos personalizados del contacto (`contacts.custom_fields`).
 * Validacion pura: la usan el servidor (POST/PUT /api/contacts) y el formulario.
 */
export type ValorCampo = string | number | boolean | null;
export type ValoresCampos = Record<string, ValorCampo>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function limpiar(campo: CampoConfig, crudo: unknown): { ok: true; valor: ValorCampo } | { ok: false; error: string } {
  if (crudo === undefined || crudo === null || crudo === "") return { ok: true, valor: null };
  switch (campo.tipo) {
    case "texto": {
      if (typeof crudo !== "string") return { ok: false, error: `${campo.etiqueta}: debe ser texto` };
      const v = crudo.trim().slice(0, 500);
      return { ok: true, valor: v === "" ? null : v };
    }
    case "numero": {
      const n = typeof crudo === "number" ? crudo : Number(String(crudo).replace(/[^\d.,-]/g, "").replace(",", "."));
      if (!Number.isFinite(n)) return { ok: false, error: `${campo.etiqueta}: debe ser un numero` };
      return { ok: true, valor: n };
    }
    case "seleccion": {
      const v = String(crudo);
      if (!campo.opciones?.includes(v)) {
        return { ok: false, error: `${campo.etiqueta}: valor fuera de las opciones (${campo.opciones?.join(", ")})` };
      }
      return { ok: true, valor: v };
    }
    case "booleano": {
      if (typeof crudo === "boolean") return { ok: true, valor: crudo };
      const s = String(crudo).toLowerCase();
      if (["true", "si", "sí", "1", "yes"].includes(s)) return { ok: true, valor: true };
      if (["false", "no", "0"].includes(s)) return { ok: true, valor: false };
      return { ok: false, error: `${campo.etiqueta}: debe ser si o no` };
    }
    case "fecha": {
      const s = String(crudo).slice(0, 10);
      if (!FECHA.test(s) || Number.isNaN(Date.parse(s))) {
        return { ok: false, error: `${campo.etiqueta}: fecha invalida (AAAA-MM-DD)` };
      }
      return { ok: true, valor: s };
    }
  }
}

/**
 * Valida un objeto de valores contra la configuracion.
 * - `parcial: true` (PUT): solo se validan las claves presentes y no se exigen requeridos.
 * - Claves que no existen en la config se rechazan: suelen ser errores de tipeo.
 */
export function validarCamposPersonalizados(
  campos: CampoConfig[],
  entrada: unknown,
  opts: { parcial?: boolean } = {}
): { ok: true; valores: ValoresCampos } | { ok: false; error: string } {
  if (entrada === undefined || entrada === null) {
    entrada = {};
  }
  if (typeof entrada !== "object" || Array.isArray(entrada)) {
    return { ok: false, error: "customFields debe ser un objeto" };
  }
  const obj = entrada as Record<string, unknown>;
  const conocidas = new Map(campos.map((c) => [c.clave, c]));

  for (const k of Object.keys(obj)) {
    if (!conocidas.has(k)) return { ok: false, error: `Campo desconocido: ${k}` };
  }

  const valores: ValoresCampos = {};
  for (const campo of campos) {
    const presente = Object.prototype.hasOwnProperty.call(obj, campo.clave);
    if (!presente) {
      if (!opts.parcial && campo.requerido) {
        return { ok: false, error: `${campo.etiqueta} es requerido` };
      }
      continue;
    }
    const r = limpiar(campo, obj[campo.clave]);
    if (!r.ok) return r;
    if (!opts.parcial && campo.requerido && r.valor === null) {
      return { ok: false, error: `${campo.etiqueta} es requerido` };
    }
    valores[campo.clave] = r.valor;
  }
  return { ok: true, valores };
}

/** Texto para mostrar un valor segun el tipo del campo. */
export function formatearValorCampo(campo: CampoConfig, valor: unknown, moneda = "USD"): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (campo.tipo) {
    case "booleano":
      return valor ? "Si" : "No";
    case "numero": {
      const n = Number(valor);
      if (!Number.isFinite(n)) return String(valor);
      const esMonto = /presupuesto|precio|monto|valor|importe/i.test(campo.clave + campo.etiqueta);
      return esMonto
        ? new Intl.NumberFormat("es", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n)
        : new Intl.NumberFormat("es").format(n);
    }
    case "fecha": {
      const d = new Date(String(valor) + "T00:00:00");
      return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
    }
    default:
      return String(valor);
  }
}

/** Resumen "Etiqueta: valor" de los campos con valor, para el prompt del agente y la ficha. */
export function resumirCampos(campos: CampoConfig[], valores: ValoresCampos | null | undefined): string[] {
  if (!valores) return [];
  return campos
    .filter((c) => valores[c.clave] !== null && valores[c.clave] !== undefined && valores[c.clave] !== "")
    .map((c) => `${c.etiqueta}: ${formatearValorCampo(c, valores[c.clave])}`);
}
