import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessContactId } from "@/lib/team";
import { requireMember } from "@/lib/api-auth";

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

  try {
    const existingRows = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1);
    const existing = existingRows[0];

    if (!existing || !(await canAccessContactId(member, existing.contactId))) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.completedAt !== undefined) {
      if (body.completedAt === null || body.completedAt === true) {
        updateData.completedAt = new Date();
      } else if (typeof body.completedAt === "string") {
        const parsed = new Date(body.completedAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "completedAt debe ser una fecha valida" },
            { status: 400 }
          );
        }
        updateData.completedAt = parsed;
      }
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string" || !body.description.trim()) {
        return NextResponse.json(
          { error: "description debe ser un texto no vacio" },
          { status: 400 }
        );
      }
      updateData.description = body.description;
    }

    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null) {
        updateData.scheduledAt = null;
      } else if (typeof body.scheduledAt === "string") {
        const parsed = new Date(body.scheduledAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "scheduledAt debe ser una fecha valida" },
            { status: 400 }
          );
        }
        updateData.scheduledAt = parsed;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const resultRows = await db
      .update(activities)
      .set(updateData)
      .where(eq(activities.id, id))
      .returning();
    const result = resultRows[0];

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Error al actualizar: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { member } = auth;
  const { id } = await params;

  try {
    const existingRows = await db
      .select()
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1);
    const existing = existingRows[0];

    if (!existing || !(await canAccessContactId(member, existing.contactId))) {
      return NextResponse.json(
        { error: "Actividad no encontrada" },
        { status: 404 }
      );
    }

    await db.delete(activities).where(eq(activities.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Error al eliminar: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
