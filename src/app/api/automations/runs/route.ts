import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { listRuns } from "@/lib/automations";

export const dynamic = "force-dynamic";

/** Historial de ejecuciones, mas reciente primero. */
export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  const params = request.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? 50)));
  const key = params.get("key") ?? undefined;

  return NextResponse.json(await listRuns({ limit, key }));
}
