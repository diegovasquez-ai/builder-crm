import { NextRequest, NextResponse } from "next/server";
import { claimAgentJob, markJobDone, markJobFailed, findStaleJobs } from "@/lib/agent/queue";
import { runAgentForContact, runAgentForConversation } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Worker del agente. Recibe { jobId } y procesa el job.
 *
 * Se invoca desde:
 * - El webhook de WhatsApp via `after()` con setTimeout (debounce)
 * - Un cron periodico (que llama GET y barre jobs stale)
 *
 * Auth: header `x-agent-secret` debe matchear AGENT_WORKER_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AGENT_WORKER_SECRET;
  if (secret) {
    if (request.headers.get("x-agent-secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.jobId) {
    return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
  }

  return await processJob(body.jobId);
}

/**
 * GET = scan de jobs stale (cron). Procesa hasta 5 en serie.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.AGENT_WORKER_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-agent-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const stale = await findStaleJobs();
  const results: Array<{ jobId: string; ok: boolean; reason?: string }> = [];
  for (const job of stale.slice(0, 5)) {
    try {
      const claim = await claimAgentJob(job.id);
      if (!claim.ok) {
        results.push({ jobId: job.id, ok: false, reason: claim.reason });
        continue;
      }
      const run = await runClaim(claim);
      if (run.ok) {
        await markJobDone(job.id, run.reason);
        results.push({ jobId: job.id, ok: true, reason: run.reason });
      } else {
        await markJobFailed(job.id, run.reason ?? "unknown");
        results.push({ jobId: job.id, ok: false, reason: run.reason });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      await markJobFailed(job.id, msg);
      results.push({ jobId: job.id, ok: false, reason: msg });
    }
  }

  return NextResponse.json({ scanned: stale.length, processed: results });
}

/**
 * Los jobs nuevos traen `conversationId` y se corren por hilo; los que quedaron
 * encolados antes de la migracion multicanal solo tienen contacto y caen al wrapper,
 * que resuelve su conversacion mas reciente.
 */
function runClaim(claim: {
  contactId: string;
  conversationId: string | null;
}) {
  return claim.conversationId
    ? runAgentForConversation(claim.conversationId)
    : runAgentForContact(claim.contactId);
}

async function processJob(jobId: string): Promise<NextResponse> {
  const claim = await claimAgentJob(jobId);
  if (!claim.ok) {
    return NextResponse.json({ skipped: true, reason: claim.reason });
  }

  try {
    const run = await runClaim(claim);
    if (run.ok) {
      await markJobDone(jobId, run.reason);
      return NextResponse.json({
        ok: true,
        reply: run.reply,
        toolCalls: run.toolCalls,
        reason: run.reason,
      });
    } else {
      await markJobFailed(jobId, run.reason ?? "unknown");
      return NextResponse.json(
        { ok: false, reason: run.reason },
        { status: 200 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[agent-worker] error", err);
    await markJobFailed(jobId, msg);
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 });
  }
}
