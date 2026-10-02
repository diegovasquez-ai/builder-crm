import { NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { countSubscriptions, hasVapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Cuantos dispositivos tiene registrados el miembro actual, y si el servidor puede enviar. */
export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  return NextResponse.json({
    configured: hasVapidKeys(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    devices: await countSubscriptions(auth.member.id),
  });
}
