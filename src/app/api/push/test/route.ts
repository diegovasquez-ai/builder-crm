import { NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { sendPushToMember } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Manda un push de prueba a los dispositivos del miembro actual. */
export async function POST() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  try {
    const outcome = await sendPushToMember(auth.member.id, {
      title: "Notificaciones activas",
      body: "Asi vas a recibir los avisos del CRM en este dispositivo.",
      url: "/settings",
      tag: "push-test",
    });
    return NextResponse.json(outcome);
  } catch (err) {
    // El mensaje del proveedor de push puede traer detalles internos (endpoints,
    // claves parciales): queda en el log del servidor y afuera va algo generico.
    console.error("[push] fallo la notificacion de prueba:", err);
    return NextResponse.json(
      { error: "No se pudo enviar la notificacion de prueba" },
      { status: 500 }
    );
  }
}
