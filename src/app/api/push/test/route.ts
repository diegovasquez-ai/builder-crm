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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando" },
      { status: 500 }
    );
  }
}
