import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { obtenerModulo, resolverApi } from "@/lib/modules";
import type { MetodoHttp } from "@/lib/modules/types";

export const dynamic = "force-dynamic";

/**
 * Catch-all de la API de modulos: /api/m/<modulo>/<ruta...>.
 * Exige miembro (requireMember) antes de delegar al handler que el modulo declara en
 * servidor.ts. Modulo inactivo o ruta sin match -> 404; metodo sin handler -> 405.
 */
async function despachar(
  request: NextRequest,
  metodo: MetodoHttp,
  ctx: { params: Promise<{ modulo: string; ruta?: string[] }> }
): Promise<Response> {
  const { modulo: nombre, ruta = [] } = await ctx.params;
  const modulo = obtenerModulo(nombre);
  if (!modulo) return NextResponse.json({ error: "Modulo no encontrado" }, { status: 404 });

  const match = resolverApi(modulo, metodo, ruta);
  if (!match) return NextResponse.json({ error: "Ruta no encontrada" }, { status: 404 });
  if (!match.handler) {
    return NextResponse.json(
      { error: "Metodo no permitido" },
      { status: 405, headers: { Allow: match.metodosPermitidos.join(", ") } }
    );
  }

  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  try {
    return await match.handler(request, { params: match.params, member: auth.member });
  } catch (err) {
    console.error(`[modulo ${nombre}] ${metodo} /${ruta.join("/")} fallo:`, err);
    return NextResponse.json({ error: "Error interno del modulo" }, { status: 500 });
  }
}

type Ctx = { params: Promise<{ modulo: string; ruta?: string[] }> };
export const GET = (req: NextRequest, ctx: Ctx) => despachar(req, "GET", ctx);
export const POST = (req: NextRequest, ctx: Ctx) => despachar(req, "POST", ctx);
export const PUT = (req: NextRequest, ctx: Ctx) => despachar(req, "PUT", ctx);
export const PATCH = (req: NextRequest, ctx: Ctx) => despachar(req, "PATCH", ctx);
export const DELETE = (req: NextRequest, ctx: Ctx) => despachar(req, "DELETE", ctx);
