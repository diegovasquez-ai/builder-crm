import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { removeSubscription, saveSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  /** Cuando el navegador rota la suscripcion (`pushsubscriptionchange`). */
  oldEndpoint?: string;
}

/** Registra este dispositivo para el miembro de la sesion. */
export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  let body: SubscriptionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const endpoint = body.endpoint ?? "";
  const p256dh = body.keys?.p256dh ?? "";
  const key = body.keys?.auth ?? "";
  if (!endpoint || !p256dh || !key) {
    return NextResponse.json({ error: "Suscripcion incompleta" }, { status: 400 });
  }

  if (body.oldEndpoint && body.oldEndpoint !== endpoint) {
    await removeSubscription(auth.member.id, body.oldEndpoint);
  }

  await saveSubscription({
    memberId: auth.member.id,
    endpoint,
    p256dh,
    auth: key,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });
  }

  await removeSubscription(auth.member.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
