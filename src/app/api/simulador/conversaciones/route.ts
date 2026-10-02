import { NextRequest, NextResponse } from "next/server";
import { isChannel } from "@/lib/channels/types";
import { moduloActivo } from "@/lib/config";
import { autorizarSimulador, crearConversacionSimulada, listarConversacionesSimuladas } from "@/lib/simulador";

export const dynamic = "force-dynamic";

/** Admin con sesion o secreto del worker, y solo si el simulador esta activo. */
async function guard(request: NextRequest) {
  if (!moduloActivo("simulador")) {
    return { response: NextResponse.json({ error: "Simulador desactivado" }, { status: 404 }) };
  }
  return autorizarSimulador(request);
}

export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ conversaciones: await listarConversacionesSimuladas() });
}

export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { canal?: unknown; nombre?: unknown } | null;
  const canal = isChannel(body?.canal) ? body.canal : "whatsapp";
  const nombre = typeof body?.nombre === "string" ? body.nombre.slice(0, 80) : null;

  const creada = await crearConversacionSimulada({ canal, nombre, member: auth.member });
  return NextResponse.json(creada, { status: 201 });
}
