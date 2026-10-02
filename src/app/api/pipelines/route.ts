import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pipelines, pipelineStages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";

const SEED_STAGES = [
  { name: "Prospecto", order: 0, color: "#64748b", isWon: false, isLost: false },
  { name: "Contactado", order: 1, color: "#2563eb", isWon: false, isLost: false },
  { name: "Propuesta", order: 2, color: "#8b5cf6", isWon: false, isLost: false },
  { name: "Negociacion", order: 3, color: "#0f766e", isWon: false, isLost: false },
  { name: "Cerrado Ganado", order: 4, color: "#16a34a", isWon: true, isLost: false },
  { name: "Cerrado Perdido", order: 5, color: "#dc2626", isWon: false, isLost: true },
];

export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const allPipelines = await db
    .select()
    .from(pipelines)
    .orderBy(asc(pipelines.order));

  const allStages = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order));

  const result = allPipelines.map((p) => ({
    ...p,
    stages: allStages.filter((s) => s.pipelineId === p.id),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
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

  const existing = await db.select({ order: pipelines.order }).from(pipelines);
  const nextOrder =
    existing.length > 0 ? Math.max(...existing.map((p) => p.order)) + 1 : 0;

  const insertedRows = await db
    .insert(pipelines)
    .values({ name, order: nextOrder, isDefault: existing.length === 0 })
    .returning();
  const inserted = insertedRows[0];

  await db.insert(pipelineStages).values(
    SEED_STAGES.map((s) => ({
      pipelineId: inserted.id,
      name: s.name,
      order: s.order,
      color: s.color,
      isWon: s.isWon,
      isLost: s.isLost,
    }))
  );

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, inserted.id))
    .orderBy(asc(pipelineStages.order));

  return NextResponse.json({ ...inserted, stages }, { status: 201 });
}
