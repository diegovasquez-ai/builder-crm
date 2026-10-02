import { NextRequest, NextResponse } from "next/server";
import { setDealStage } from "@/lib/deals/stage";
import { db } from "@/db";
import { pipelineStages, pipelines, deals, contacts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";
import { ownerFilter } from "@/lib/team";
import { countDocumentsByContact } from "@/lib/documents";

export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  const stages = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order));

  const allDeals = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      stageId: deals.stageId,
      contactId: deals.contactId,
      expectedClose: deals.expectedClose,
      probability: deals.probability,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      contactName: contacts.name,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .where(ownerFilter(auth.member));

  const docCounts = await countDocumentsByContact([...new Set(allDeals.map((d) => d.contactId))]);

  const pipeline = stages.map((stage) => ({
    ...stage,
    deals: allDeals
      .filter((d) => d.stageId === stage.id)
      .map((d) => ({ ...d, docCount: docCounts[d.contactId] ?? 0 })),
  }));

  return NextResponse.json(pipeline);
}

export async function PUT(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // Update a single deal's stage (drag and drop)
  if (body.dealId && body.stageId) {
    const existingRows = await db.select().from(deals).where(eq(deals.id, body.dealId)).limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }

    // Unico camino de cambio de etapa: emite `deal.stage_changed`.
    const moved = await setDealStage({ dealId: body.dealId, stageId: body.stageId });
    if (!moved.ok) {
      return NextResponse.json({ error: moved.error }, { status: 400 });
    }
    const [result] = await db
      .select()
      .from(deals)
      .where(eq(deals.id, body.dealId))
      .limit(1);
    return NextResponse.json(result);
  }

  // Bulk update stages (from /setup or /customize)
  if (body.stages && Array.isArray(body.stages)) {
    // Delete existing stages (only if no deals reference them)
    const existingDeals = await db.select().from(deals);
    if (existingDeals.length > 0) {
      return NextResponse.json(
        {
          error:
            "No se pueden reemplazar etapas cuando hay deals activos. Elimina los deals primero.",
        },
        { status: 400 }
      );
    }

    // Legacy path used by /customize and /setup skills.
    // Replaces stages on the default pipeline. Prefer /api/stages for new UIs.
    const defaultPipelineRows = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.isDefault, true))
      .limit(1);
    const defaultPipelineId = defaultPipelineRows[0]?.id;

    if (!defaultPipelineId) {
      return NextResponse.json(
        { error: "No hay pipeline default configurado" },
        { status: 400 }
      );
    }

    await db
      .delete(pipelineStages)
      .where(eq(pipelineStages.pipelineId, defaultPipelineId));

    for (const stage of body.stages) {
      await db.insert(pipelineStages).values({
        pipelineId: defaultPipelineId,
        name: stage.name,
        order: stage.order,
        color: stage.color || "#64748b",
        isWon: stage.isWon || false,
        isLost: stage.isLost || false,
      });
    }

    const updated = await db
      .select()
      .from(pipelineStages)
      .orderBy(asc(pipelineStages.order));

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Request invalido" }, { status: 400 });
}
