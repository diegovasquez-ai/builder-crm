import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";
import { ownerFilter } from "@/lib/team";

export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");
  const dealId = searchParams.get("dealId");

  const conditions: SQL[] = [];
  const visibility = ownerFilter(auth.member);
  if (visibility) conditions.push(visibility);
  if (contactId) conditions.push(eq(activities.contactId, contactId));
  if (dealId) conditions.push(eq(activities.dealId, dealId));

  const baseQuery = db
    .select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      contactId: activities.contactId,
      dealId: activities.dealId,
      scheduledAt: activities.scheduledAt,
      completedAt: activities.completedAt,
      createdAt: activities.createdAt,
      contactName: contacts.name,
    })
    .from(activities)
    .leftJoin(contacts, eq(activities.contactId, contacts.id));

  const results = await (conditions.length > 0
    ? baseQuery.where(and(...conditions)).orderBy(desc(activities.createdAt))
    : baseQuery.orderBy(desc(activities.createdAt)));

  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const { type, description, contactId, dealId, scheduledAt } = body;

  if (!type || !description || !contactId) {
    return NextResponse.json(
      { error: "Tipo, descripcion y contacto son requeridos" },
      { status: 400 }
    );
  }

  try {
    const resultRows = await db
      .insert(activities)
      .values({
        type,
        description,
        contactId,
        dealId: dealId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        completedAt: null,
        createdAt: new Date(),
      })
      .returning();
    const result = resultRows[0];

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return NextResponse.json(
      { error: `Error al crear actividad: ${msg}` },
      { status: 500 }
    );
  }
}
