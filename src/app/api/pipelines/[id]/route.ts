import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pipelines, pipelineStages, deals } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  const updatedRows = await db
    .update(pipelines)
    .set({ name, updatedAt: new Date() })
    .where(eq(pipelines.id, id))
    .returning();

  if (updatedRows.length === 0) {
    return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
  }

  return NextResponse.json(updatedRows[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const stages = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, id));

  if (stages.length > 0) {
    const stageIds = stages.map((s) => s.id);
    const dealRows = await db
      .select({ id: deals.id })
      .from(deals)
      .where(inArray(deals.stageId, stageIds));

    if (dealRows.length > 0) {
      return NextResponse.json(
        {
          error: "No se puede borrar un pipeline con deals",
          dealCount: dealRows.length,
        },
        { status: 409 }
      );
    }
  }

  // Cascade delete on pipeline_id removes stages automatically
  const deleted = await db
    .delete(pipelines)
    .where(eq(pipelines.id, id))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
