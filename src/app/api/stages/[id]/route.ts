import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pipelineStages, deals } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  const updates: { name?: string; color?: string } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Nombre invalido" }, { status: 400 });
    }
    updates.name = trimmed;
  }
  if (typeof body.color === "string") {
    updates.color = body.color;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const updatedRows = await db
    .update(pipelineStages)
    .set(updates)
    .where(eq(pipelineStages.id, id))
    .returning();

  if (updatedRows.length === 0) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
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

  const dealRows = await db
    .select({ id: deals.id })
    .from(deals)
    .where(eq(deals.stageId, id));

  if (dealRows.length > 0) {
    return NextResponse.json(
      {
        error: "La etapa tiene deals",
        dealCount: dealRows.length,
      },
      { status: 409 }
    );
  }

  const deleted = await db
    .delete(pipelineStages)
    .where(eq(pipelineStages.id, id))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
