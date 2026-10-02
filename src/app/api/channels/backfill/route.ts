import { NextRequest, NextResponse } from "next/server";
import { backfillFromZernio } from "@/lib/channels/backfill";
import { isChannel } from "@/lib/channels/types";
import { requireMember } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
// Recorrer cientos de hilos y sus mensajes no entra en el timeout por defecto.
export const maxDuration = 300;

/**
 * Importa el historial que Zernio ya replico al conectar la cuenta. No dispara el
 * agente: ver la nota en `src/lib/channels/backfill.ts`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const channel = request.nextUrl.searchParams.get("channel");
  const result = await backfillFromZernio({
    channel: isChannel(channel) ? channel : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
