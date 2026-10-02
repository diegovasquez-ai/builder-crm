import "server-only";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ModuloServidor, HandlerModulo } from "@/lib/modules/types";
import manifiesto from "./manifiesto";

/**
 * PLANTILLA DE MODULO — lado servidor.
 *
 * - `paginas`: componentes por patron de ruta relativa a /m/<nombre>:
 *     ""            -> /m/<nombre>
 *     "nueva"       -> /m/<nombre>/nueva
 *     "[id]"        -> /m/<nombre>/abc   (params.id = "abc")
 *     "[id]/editar" -> /m/<nombre>/abc/editar
 *   Reciben { params, searchParams, member }. Pueden ser async (server) y renderizar
 *   componentes cliente ("use client") de ./componentes.
 * - `api`: handlers por patron y metodo, ya protegidos por requireMember.
 *   Reciben (request, { params, member }) y devuelven Response.
 * - `tools`: lo que el agente puede hacer con este modulo (nombre unico).
 * - `seed`: datos de demostracion, idempotente.
 *
 * Las tablas del modulo viven en migrations/ (no en src/db/schema.ts) y se consultan
 * con `sql` tipado. Prefijo = nombre del modulo. RLS obligatorio.
 */

const listar: HandlerModulo = async (_req, { member }) => {
  const filas = await db.execute(sql`select 1 as ok where ${member.id}::text is not null`);
  return NextResponse.json(filas);
};

const modulo: ModuloServidor = {
  manifiesto,

  paginas: {
    "": async ({ member }) => (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Mi modulo</h1>
        <p className="text-sm text-muted-foreground">Hola, {member.name ?? member.email}.</p>
      </div>
    ),
  },

  api: {
    "": { GET: listar },
  },

  tools: [],

  async seed() {
    // insertar datos de demostracion si no existen
  },
};

export default modulo;
