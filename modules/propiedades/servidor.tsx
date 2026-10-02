import "server-only";
import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import type { ModuloServidor, HandlerModulo, ToolModulo } from "@/lib/modules/types";
import manifiesto from "./manifiesto";
import { propiedades } from "./tabla";
import { searchProperty } from "./lib/busqueda";
import { embed, hasOpenAIKey, toVectorLiteral } from "./lib/embeddings";
import { ListaPropiedades } from "./componentes/ListaPropiedades";

// ============================================================
// Catalogo
// ============================================================

const COLUMNAS_PUBLICAS = {
  id: propiedades.id,
  titulo: propiedades.title,
  tipo: propiedades.propertyType,
  operacion: propiedades.operation,
  precio: propiedades.price,
  moneda: propiedades.currency,
  ambientes: propiedades.rooms,
  dormitorios: propiedades.bedrooms,
  banos: propiedades.bathrooms,
  m2: propiedades.surfaceTotal,
  barrio: propiedades.neighborhood,
  ubicacion: propiedades.fullLocation,
  direccion: propiedades.address,
  expensas: propiedades.expenses,
  aptoCredito: propiedades.creditEligible,
  amenities: propiedades.amenities,
  foto: propiedades.coverPhoto,
  link: propiedades.publicUrl,
  descripcion: propiedades.description,
};

async function listarCatalogo(limit = 100) {
  return db.select(COLUMNAS_PUBLICAS).from(propiedades).orderBy(desc(propiedades.updatedAt)).limit(limit);
}

const listar: HandlerModulo = async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json(await listarCatalogo());
  const patron = `%${q}%`;
  const rows = await db
    .select(COLUMNAS_PUBLICAS)
    .from(propiedades)
    .where(or(ilike(propiedades.title, patron), ilike(propiedades.address, patron), ilike(propiedades.neighborhood, patron), ilike(propiedades.fullLocation, patron)))
    .limit(50);
  return NextResponse.json(rows);
};

// ============================================================
// Tools del agente
// ============================================================

interface ArgsBusqueda {
  consulta?: string;
  operacion?: string;
  tipo?: string;
  precio_min?: number;
  precio_max?: number;
  moneda?: string;
  ambientes_min?: number;
  barrio?: string;
  apto_credito?: boolean;
}

function normalizeOperacion(op?: string): string | null {
  if (!op) return null;
  const o = op.toLowerCase();
  if (o.startsWith("venta") || o.startsWith("compra")) return "Venta";
  if (o.startsWith("alq") || o.startsWith("arr")) return "Alquiler";
  return op;
}

/** Sin embeddings: filtros SQL sobre el catalogo (demo y clientes sin OpenAI). */
async function buscarPorFiltros(args: ArgsBusqueda) {
  const cond: SQL[] = [];
  const op = normalizeOperacion(args.operacion);
  if (op) cond.push(ilike(propiedades.operation, op));
  if (args.tipo) cond.push(ilike(propiedades.propertyType, `%${args.tipo}%`));
  if (args.precio_min) cond.push(gte(propiedades.price, String(args.precio_min)));
  if (args.precio_max) cond.push(lte(propiedades.price, String(args.precio_max)));
  if (args.moneda) cond.push(eq(propiedades.currency, args.moneda));
  if (args.ambientes_min) cond.push(gte(propiedades.rooms, args.ambientes_min));
  if (args.barrio) cond.push(or(ilike(propiedades.neighborhood, `%${args.barrio}%`), ilike(propiedades.fullLocation, `%${args.barrio}%`))!);
  if (typeof args.apto_credito === "boolean") cond.push(eq(propiedades.creditEligible, args.apto_credito));
  const q = db.select(COLUMNAS_PUBLICAS).from(propiedades);
  return (cond.length ? q.where(and(...cond)) : q).orderBy(propiedades.price).limit(6);
}

async function buscarPropiedades(args: ArgsBusqueda) {
  const consulta = args.consulta?.trim();
  if (!consulta) return { ok: false, error: "consulta vacia" };

  let rows: Array<Record<string, unknown>>;
  if (hasOpenAIKey()) {
    let vec: string;
    try {
      vec = toVectorLiteral(await embed(consulta));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error generando embedding" };
    }
    const result = await db.execute(sql`
      select * from propiedades_buscar(
        ${vec}::vector(1536), ${6}, ${normalizeOperacion(args.operacion)}, ${args.tipo ?? null},
        ${args.precio_min ?? null}, ${args.precio_max ?? null}, ${args.moneda ?? null},
        ${args.ambientes_min ?? null}, ${args.barrio ?? null}, ${args.apto_credito ?? null}
      )`);
    rows = (result as unknown as Array<Record<string, unknown>>).map((r) => ({
      titulo: r.title,
      tipo: r.property_type,
      operacion: r.operation,
      precio: r.price,
      moneda: r.currency,
      ambientes: r.rooms,
      dormitorios: r.bedrooms,
      banos: r.bathrooms,
      m2: r.surface_total,
      barrio: r.neighborhood,
      ubicacion: r.full_location,
      direccion: r.address,
      expensas: r.expenses,
      aptoCredito: r.credit_eligible,
      amenities: r.amenities,
      link: r.public_url,
    }));
    // Catalogo sin embeddings todavia (seed o sync sin OpenAI): caer a filtros.
    if (rows.length === 0) rows = await buscarPorFiltros(args);
  } else {
    rows = await buscarPorFiltros(args);
  }

  if (rows.length === 0) return { ok: false, error: "no encontre propiedades que coincidan con esos criterios" };
  return { ok: true, data: { cantidad: rows.length, propiedades: rows } };
}

async function etiquetarContacto(contactId: string, tag: string | null | undefined) {
  const t = tag?.trim();
  if (!t) return;
  try {
    const [c] = await db.select({ tags: contacts.tags }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
    if (!c || (c.tags ?? []).some((x) => x.toLowerCase() === t.toLowerCase())) return;
    await db.update(contacts).set({ tags: [...(c.tags ?? []), t], updatedAt: new Date() }).where(eq(contacts.id, contactId));
  } catch {
    /* no bloquear la respuesta del agente por una etiqueta */
  }
}

const tools: ToolModulo[] = [
  {
    definicion: {
      type: "function",
      function: {
        name: "buscar_info_propiedades",
        description:
          "Busca UNA propiedad puntual del catalogo por direccion, nombre o link de portal inmobiliario y devuelve sus datos publicos (precio, ambientes, m2, link). Usar cuando el cliente pregunta por una propiedad concreta.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "Direccion, nombre de la propiedad o URL del portal." } },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    descripcionUI: "[Propiedades] Busca una propiedad puntual del catalogo por direccion, nombre o link (Firecrawl opcional para links).",
    async ejecutar(args, ctx) {
      const query = String(args.query ?? "").trim();
      if (!query) return { ok: false, error: "query vacio" };
      const result = await searchProperty(query);
      if (result.esDesarrollo) {
        return { ok: false, error: "El cliente consulta por un desarrollo (proyecto en construccion): derivar a una persona.", data: { esDesarrollo: true } };
      }
      if (!result.ok || !result.match) {
        return { ok: false, error: result.error ?? "no encontre la propiedad", data: result.scraped ? { scraped: result.scraped } : undefined };
      }
      const m = result.match;
      await etiquetarContacto(ctx.contactId, m.direccion);
      // Solo lo publico: nunca telefono ni nombre del propietario.
      return {
        ok: true,
        data: {
          direccion: m.direccion,
          barrio: m.barrio,
          ubicacion: m.ubicacion,
          tipo: m.tipo,
          operacion: m.operacion,
          ambientes: m.ambientes,
          banos: m.banos,
          m2: m.m2,
          valor: m.valor,
          expensas: m.expensas,
          amenities: m.amenities,
          aptoCredito: m.aptoCredito,
          descripcion: m.descripcion,
          linkPublicacion: m.link,
          referenceCode: m.referenceCode,
        },
      };
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "buscar_propiedades",
        description:
          "Busca propiedades del catalogo por CRITERIOS (zona, presupuesto, ambientes, tipo, caracteristicas) cuando el cliente describe lo que busca en vez de una propiedad puntual. Devuelve hasta 6 opciones.",
        parameters: {
          type: "object",
          properties: {
            consulta: { type: "string", description: "Descripcion completa de lo que busca el cliente." },
            operacion: { type: "string", enum: ["venta", "alquiler"] },
            tipo: { type: "string", description: "departamento, casa, oficina, local, terreno..." },
            precio_min: { type: "number" },
            precio_max: { type: "number" },
            moneda: { type: "string", description: "Codigo ISO, ej. USD, CLP, ARS, MXN" },
            ambientes_min: { type: "number" },
            barrio: { type: "string", description: "Barrio, comuna, localidad o zona." },
            apto_credito: { type: "boolean" },
          },
          required: ["consulta"],
          additionalProperties: false,
        },
      },
    },
    descripcionUI: "[Propiedades] Busca propiedades por criterios (semantica con OPENAI_API_KEY; por filtros si no).",
    ejecutar: (a) => buscarPropiedades(a as ArgsBusqueda),
  },
];

// ============================================================
// Modulo
// ============================================================

const DEMO = [
  { external_id: "demo-1", title: "Departamento 2D luminoso en Providencia", property_type: "Departamento", operation: "Venta", price: 165000, currency: "USD", rooms: 3, bedrooms: 2, bathrooms: 2, surface_total: 68, neighborhood: "Providencia", full_location: "Providencia, Santiago", address: "Av. Providencia 1234, depto 503", credit_eligible: true, amenities: ["Estacionamiento", "Bodega", "Gimnasio"], description: "Departamento de 2 dormitorios con terraza, orientacion norte, a pasos del metro." },
  { external_id: "demo-2", title: "Casa 4D con patio en La Reina", property_type: "Casa", operation: "Venta", price: 320000, currency: "USD", rooms: 6, bedrooms: 4, bathrooms: 3, surface_total: 210, neighborhood: "La Reina", full_location: "La Reina, Santiago", address: "Calle Los Alerces 456", credit_eligible: true, amenities: ["Patio", "Quincho", "Estacionamiento 2 autos"], description: "Casa familiar en barrio tranquilo, patio amplio y quincho techado." },
  { external_id: "demo-3", title: "Oficina 45 m2 en Las Condes", property_type: "Oficina", operation: "Arriendo", price: 900, currency: "USD", rooms: 2, bedrooms: null, bathrooms: 1, surface_total: 45, neighborhood: "Las Condes", full_location: "Las Condes, Santiago", address: "Av. Apoquindo 3000, of. 1202", credit_eligible: false, amenities: ["Recepcion", "Sala de reuniones"], description: "Oficina habilitada en edificio corporativo con recepcion y estacionamiento de visitas." },
  { external_id: "demo-4", title: "Departamento 1D en Nunoa, ideal inversion", property_type: "Departamento", operation: "Venta", price: 95000, currency: "USD", rooms: 2, bedrooms: 1, bathrooms: 1, surface_total: 42, neighborhood: "Nunoa", full_location: "Nunoa, Santiago", address: "Irarrazaval 2200, depto 801", credit_eligible: true, amenities: ["Piscina", "Gimnasio"], description: "Un dormitorio con balcon, edificio nuevo, excelente conectividad." },
  { external_id: "demo-5", title: "Casa 3D en arriendo en Vitacura", property_type: "Casa", operation: "Arriendo", price: 2400, currency: "USD", rooms: 5, bedrooms: 3, bathrooms: 2, surface_total: 160, neighborhood: "Vitacura", full_location: "Vitacura, Santiago", address: "Pasaje Las Dalias 18", credit_eligible: false, amenities: ["Jardin", "Estacionamiento"], description: "Casa de un piso con jardin, cerca de colegios." },
  { external_id: "demo-6", title: "Terreno 500 m2 en Colina", property_type: "Terreno", operation: "Venta", price: 78000, currency: "USD", rooms: null, bedrooms: null, bathrooms: null, surface_total: 500, neighborhood: "Colina", full_location: "Colina, Region Metropolitana", address: "Parcela 12, Camino El Alba", credit_eligible: false, amenities: [], description: "Terreno plano con factibilidad de agua y luz, ideal para construir." },
];

const modulo: ModuloServidor = {
  manifiesto,

  paginas: {
    "": async () => <ListaPropiedades filas={await listarCatalogo()} />,
  },

  api: {
    "": { GET: listar },
  },

  tools,

  async seed() {
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from propiedades`)) as unknown as [{ n: number }];
    if (n > 0) return;
    await db.insert(propiedades).values(
      DEMO.map((d) => ({
        externalId: d.external_id,
        title: d.title,
        propertyType: d.property_type,
        operation: d.operation,
        price: String(d.price),
        currency: d.currency,
        rooms: d.rooms,
        bedrooms: d.bedrooms,
        bathrooms: d.bathrooms,
        surfaceTotal: String(d.surface_total),
        neighborhood: d.neighborhood,
        fullLocation: d.full_location,
        address: d.address,
        creditEligible: d.credit_eligible,
        amenities: d.amenities,
        description: d.description,
        publicUrl: null,
        status: 2,
      }))
    );
  },
};

export default modulo;
