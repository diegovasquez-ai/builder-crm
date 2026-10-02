import { NextRequest, NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/team";
import { cargarDatosDemo } from "@/lib/seed-demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Carga los datos de demostracion. Acepta un admin con sesion (boton del inicio) o el
 * secreto del worker como Bearer (scripts/seed-demo.mjs y la skill deploy-coolify).
 * Idempotente: una segunda llamada no duplica nada.
 */
export async function POST(request: NextRequest) {
  const secreto = process.env.AGENT_WORKER_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const porSecreto = Boolean(secreto) && bearer === secreto;

  if (!porSecreto) {
    const member = await getCurrentMember();
    if (!member || member.role !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede cargar la demo" }, { status: 403 });
    }
  }

  try {
    const resultado = await cargarDatosDemo();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    console.error("[seed] fallo:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
