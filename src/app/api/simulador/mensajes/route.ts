import { NextRequest, NextResponse } from "next/server";
import { moduloActivo } from "@/lib/config";
import { autorizarSimulador, enviarMensajeSimulado } from "@/lib/simulador";

export const dynamic = "force-dynamic";
// Un turno del agente tarda entre 5 y 30 s (LLM + tools); se espera en la misma llamada.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!moduloActivo("simulador")) {
    return NextResponse.json({ error: "Simulador desactivado" }, { status: 404 });
  }
  const auth = await autorizarSimulador(request);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { conversationId?: unknown; texto?: unknown } | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  if (!conversationId || !texto) {
    return NextResponse.json({ error: "conversationId y texto son requeridos" }, { status: 400 });
  }

  // Que el agente no pueda contestar NO es un error de esta ruta: el mensaje entro al
  // CRM igual y vuelve en la respuesta con `agente.ok === false` y el motivo. Aca solo
  // quedan los dos casos en que no hay nada que simular.
  const r = await enviarMensajeSimulado({ conversationId, texto: texto.slice(0, 4000) });
  if ("error" in r) {
    const mensaje =
      r.error === "no_simulada" ? "Esa conversacion no es del simulador." : "Conversacion no encontrada.";
    return NextResponse.json({ error: r.error, mensaje }, { status: r.error === "no_encontrada" ? 404 : 400 });
  }
  return NextResponse.json(r);
}
