import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pipelineStages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";

export async function PUT(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const pipelineId = typeof body.pipelineId === "string" ? body.pipelineId : "";
  const stageIds: unknown = body.stageIds;

  if (!pipelineId || !Array.isArray(stageIds) || stageIds.some((s) => typeof s !== "string")) {
    return NextResponse.json(
      { error: "pipelineId y stageIds[] requeridos" },
      { status: 400 }
    );
  }

  const ids = stageIds as string[];

  await Promise.all(
    ids.map((stageId, index) =>
      db
        .update(pipelineStages)
        .set({ order: index })
        .where(
          and(eq(pipelineStages.id, stageId), eq(pipelineStages.pipelineId, pipelineId))
        )
    )
  );

  return NextResponse.json({ ok: true });
}
