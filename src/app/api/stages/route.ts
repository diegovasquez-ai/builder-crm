import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pipelineStages, pipelines } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const pipelineId = typeof body.pipelineId === "string" ? body.pipelineId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" ? body.color : "#64748b";

  if (!pipelineId || !name) {
    return NextResponse.json(
      { error: "pipelineId y name son requeridos" },
      { status: 400 }
    );
  }

  const pipelineExists = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1);

  if (pipelineExists.length === 0) {
    return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
  }

  const existing = await db
    .select({ order: pipelineStages.order })
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(asc(pipelineStages.order));

  const nextOrder =
    typeof body.order === "number"
      ? body.order
      : existing.length > 0
        ? Math.max(...existing.map((s) => s.order)) + 1
        : 0;

  const insertedRows = await db
    .insert(pipelineStages)
    .values({ pipelineId, name, color, order: nextOrder })
    .returning();

  return NextResponse.json(insertedRows[0], { status: 201 });
}
