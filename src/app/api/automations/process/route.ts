import { NextRequest, NextResponse } from "next/server";
import { processStaleRuns } from "@/lib/automations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sweeper de automatizaciones. El camino normal es `after()` justo despues del
 * evento; esto retoma lo que quedo `pending` si esa funcion murio. Lo llama el
 * cron de GitHub Actions con el mismo secreto que el worker del agente.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.AGENT_WORKER_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    const provided =
      authHeader?.replace(/^Bearer\s+/i, "") ??
      request.headers.get("x-agent-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const reprocessed = await processStaleRuns();
  return NextResponse.json({ ok: true, reprocessed });
}
