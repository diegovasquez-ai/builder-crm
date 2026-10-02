import { NextRequest, NextResponse } from "next/server";
import { setDealStage } from "@/lib/deals/stage";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessContactId } from "@/lib/team";
import { requireMember } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { member } = auth;
  const { id } = await params;

  const dealRows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  const deal = dealRows[0];

  if (!deal || !(await canAccessContactId(member, deal.contactId))) {
    return NextResponse.json(
      { error: "Deal no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(deal);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { member } = auth;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const existingRows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  const existing = existingRows[0];

  if (!existing || !(await canAccessContactId(member, existing.contactId))) {
    return NextResponse.json(
      { error: "Deal no encontrado" },
      { status: 404 }
    );
  }

  // Only allow updating specific fields
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.value !== undefined) updateData.value = body.value;
  // La etapa va por `setDealStage`, que emite el evento de la automatizacion.
  if (body.stageId !== undefined && body.stageId !== existing.stageId) {
    const moved = await setDealStage({ dealId: id, stageId: body.stageId });
    if (!moved.ok) {
      return NextResponse.json({ error: moved.error }, { status: 400 });
    }
  }
  if (body.contactId !== undefined) {
    if (!(await canAccessContactId(member, String(body.contactId)))) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }
    updateData.contactId = body.contactId;
  }
  if (body.expectedClose !== undefined) {
    updateData.expectedClose = body.expectedClose ? new Date(body.expectedClose) : null;
  }
  if (body.probability !== undefined) {
    updateData.probability = Math.max(0, Math.min(100, Number(body.probability)));
  }
  if (body.notes !== undefined) updateData.notes = body.notes;

  const resultRows = await db
    .update(deals)
    .set(updateData)
    .where(eq(deals.id, id))
    .returning();
  const result = resultRows[0];

  return NextResponse.json(result);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { member } = auth;
  const { id } = await params;

  const existingRows = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  const existing = existingRows[0];

  if (!existing || !(await canAccessContactId(member, existing.contactId))) {
    return NextResponse.json(
      { error: "Deal no encontrado" },
      { status: 404 }
    );
  }

  await db.delete(deals).where(eq(deals.id, id));
  return NextResponse.json({ success: true });
}
