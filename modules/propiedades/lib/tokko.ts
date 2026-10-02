/**
 * Cliente de la API REST de Tokko Broker (catalogo inmobiliario).
 * Docs: https://developers.tokkobroker.com/  ·  base v1, auth por query param `key`.
 *
 * Solo lectura: lista propiedades del catalogo y las mapea a filas de la tabla `propiedades`.
 * El token va en TOKKO_API_KEY (.env.local, nunca en el repo).
 */

const TOKKO_BASE = "https://www.tokkobroker.com/api/v1";

function getTokkoKey(): string {
  const key = process.env.TOKKO_API_KEY;
  if (!key) throw new Error("TOKKO_API_KEY no configurada");
  return key;
}

// ---- Tipos parciales de la respuesta de Tokko (solo lo que usamos) ----
interface TokkoPrice {
  currency: string;
  price: number;
  period?: number;
  is_promotional?: boolean;
}
interface TokkoOperation {
  operation_type: string; // "Venta" | "Alquiler" | "Alquiler temporario"
  prices: TokkoPrice[];
}
interface TokkoPhoto {
  image: string;
  original?: string;
  is_front_cover?: boolean;
  order?: number;
}
interface TokkoTag {
  id: number;
  name: string;
  type: number;
}
interface TokkoLocation {
  name?: string;
  full_location?: string;
  short_location?: string;
}
interface TokkoType {
  code?: string;
  id?: number;
  name?: string;
}
export interface TokkoProperty {
  id: number;
  reference_code?: string;
  publication_title?: string;
  type?: TokkoType;
  operations?: TokkoOperation[];
  room_amount?: number;
  suite_amount?: number;
  bathroom_amount?: number;
  total_surface?: string | number;
  roofed_surface?: string | number;
  location?: TokkoLocation;
  address?: string;
  real_address?: string;
  geo_lat?: string | number;
  geo_long?: string | number;
  credit_eligible?: boolean;
  expenses?: number;
  tags?: TokkoTag[];
  photos?: TokkoPhoto[];
  public_url?: string;
  status?: number;
  description?: string;
  rich_description?: string;
  [key: string]: unknown;
}

interface TokkoListResponse {
  meta: { total_count: number; limit: number; offset: number; next: string | null };
  objects: TokkoProperty[];
}

/** Trae TODAS las propiedades del catalogo, paginando de a `pageSize`. */
export async function listAllProperties(pageSize = 100): Promise<TokkoProperty[]> {
  const key = getTokkoKey();
  const all: TokkoProperty[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url =
      `${TOKKO_BASE}/property/?key=${key}&lang=es_ar&format=json` +
      `&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Tokko /property fallo: HTTP ${res.status}`);
    }
    const data = (await res.json()) as TokkoListResponse;
    total = data.meta?.total_count ?? all.length;
    const objects = data.objects ?? [];
    all.push(...objects);
    if (objects.length === 0) break;
    offset += pageSize;
  }
  return all;
}

// ---- Mapeo Tokko -> fila de la tabla `propiedades` ----
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export interface PropertyRow {
  external_id: string;
  reference_code: string | null;
  title: string | null;
  property_type: string | null;
  operation: string | null;
  price: number | null;
  currency: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface_total: number | null;
  surface_covered: number | null;
  neighborhood: string | null;
  full_location: string | null;
  address: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  credit_eligible: boolean | null;
  expenses: number | null;
  amenities: string[];
  cover_photo: string | null;
  photos: string[];
  public_url: string | null;
  status: number | null;
  description: string | null;
  embedding_text: string;
  raw: TokkoProperty;
}

export function mapTokkoToPropertyRow(p: TokkoProperty): PropertyRow {
  const op = p.operations?.[0];
  const price = op?.prices?.[0];
  const photos = (p.photos ?? []).map((ph) => ph.image).filter(Boolean);
  const cover =
    (p.photos ?? []).find((ph) => ph.is_front_cover)?.image ?? photos[0] ?? null;
  const amenities = (p.tags ?? []).map((t) => t.name).filter(Boolean);
  const description = (p.rich_description || p.description || "").trim() || null;
  const address = (p.real_address || p.address || "").trim() || null;

  const row: PropertyRow = {
    external_id: String(p.id),
    reference_code: p.reference_code ?? null,
    title: p.publication_title?.trim() || null,
    property_type: p.type?.name ?? null,
    operation: op?.operation_type ?? null,
    price: toNumber(price?.price),
    currency: price?.currency ?? null,
    rooms: toNumber(p.room_amount),
    bedrooms: toNumber(p.suite_amount),
    bathrooms: toNumber(p.bathroom_amount),
    surface_total: toNumber(p.total_surface),
    surface_covered: toNumber(p.roofed_surface),
    neighborhood: p.location?.name ?? null,
    full_location: p.location?.full_location ?? null,
    address,
    geo_lat: toNumber(p.geo_lat),
    geo_lng: toNumber(p.geo_long),
    credit_eligible:
      typeof p.credit_eligible === "boolean" ? p.credit_eligible : null,
    expenses: toNumber(p.expenses),
    amenities,
    cover_photo: cover,
    photos,
    public_url: p.public_url ?? null,
    status: toNumber(p.status),
    description,
    embedding_text: "",
    raw: p,
  };
  row.embedding_text = buildEmbeddingText(row);
  return row;
}

/** Texto canonico que se vectoriza: mezcla atributos duros + descripcion libre. */
export function buildEmbeddingText(r: PropertyRow): string {
  const parts: string[] = [];
  if (r.property_type) parts.push(r.property_type);
  if (r.operation) parts.push(`en ${r.operation}`);
  if (r.full_location) parts.push(r.full_location);
  else if (r.neighborhood) parts.push(r.neighborhood);
  if (r.address) parts.push(r.address);

  const specs: string[] = [];
  if (r.rooms) specs.push(`${r.rooms} ambientes`);
  if (r.bedrooms) specs.push(`${r.bedrooms} dormitorios`);
  if (r.bathrooms) specs.push(`${r.bathrooms} banos`);
  if (r.surface_total) specs.push(`${r.surface_total} m2`);
  if (specs.length) parts.push(specs.join(", "));

  if (r.price && r.currency) parts.push(`${r.currency} ${r.price}`);
  if (r.credit_eligible) parts.push("apto credito");
  if (r.amenities.length) parts.push(`Amenities: ${r.amenities.join(", ")}`);
  if (r.description) parts.push(r.description);

  return parts.join(" · ").replace(/\s+/g, " ").trim();
}
