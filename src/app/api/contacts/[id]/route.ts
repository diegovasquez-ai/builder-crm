import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, deals, activities, teamMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";
import { camposContacto } from "@/lib/config";
import { validarCamposPersonalizados } from "@/lib/config/campos";
import { canAccessContact } from "@/lib/team";
import { assignContact } from "@/lib/contacts/assign";
import { purgeContactDocuments } from "@/lib/documents";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const contactRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  const contact = contactRows[0];

  // 404 tambien para lo ajeno: no confirmar que existe.
  if (!contact || !canAccessContact(auth.member, contact)) {
    return NextResponse.json(
      { error: "Contacto no encontrado" },
      { status: 404 }
    );
  }

  const [owner] = contact.ownerId
    ? await db
        .select({ id: teamMembers.id, name: teamMembers.name, email: teamMembers.email })
        .from(teamMembers)
        .where(eq(teamMembers.id, contact.ownerId))
        .limit(1)
    : [];

  const contactDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.contactId, id));

  const contactActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, id));

  return NextResponse.json({
    ...contact,
    owner: owner ?? null,
    deals: contactDeals,
    activities: contactActivities,
  });
}

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

  const existingRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  const existing = existingRows[0];

  if (!existing || !canAccessContact(auth.member, existing)) {
    return NextResponse.json(
      { error: "Contacto no encontrado" },
      { status: 404 }
    );
  }

  // El propietario va por `assignContact`: es lo que emite el evento de la
  // automatizacion. Solo el admin reasigna; un asesor no puede regalar ni robar.
  if (body.ownerId !== undefined) {
    if (auth.member.role !== "admin") {
      return NextResponse.json(
        { error: "Solo un administrador puede cambiar el propietario" },
        { status: 403 }
      );
    }
    const result = await assignContact({
      contactId: id,
      ownerId: body.ownerId || null,
      by: { type: "member", member: auth.member },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  // Only allow updating specific fields
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.company !== undefined) updateData.company = body.company;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.score !== undefined) updateData.score = Math.max(0, Math.min(100, body.score));
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.tags !== undefined) {
    updateData.tags = Array.isArray(body.tags)
      ? body.tags
          .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
          .filter((t: string) => t.length > 0)
      : [];
  }
  if (body.customFields !== undefined) {
    // Parcial: se mezclan con lo guardado, solo se validan las claves que vienen.
    const campos = validarCamposPersonalizados(camposContacto(), body.customFields, { parcial: true });
    if (!campos.ok) {
      return NextResponse.json({ error: campos.error }, { status: 400 });
    }
    updateData.customFields = {
      ...((existing.customFields as Record<string, unknown> | null) ?? {}),
      ...campos.valores,
    };
  }

  const resultRows = await db
    .update(contacts)
    .set(updateData)
    .where(eq(contacts.id, id))
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
  const { id } = await params;

  const existingRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  const existing = existingRows[0];

  if (!existing || !canAccessContact(auth.member, existing)) {
    return NextResponse.json(
      { error: "Contacto no encontrado" },
      { status: 404 }
    );
  }

  // Los archivos del bucket no se van por cascade: primero ellos, despues la fila.
  await purgeContactDocuments(id);
  await db.delete(contacts).where(eq(contacts.id, id));
  return NextResponse.json({ success: true });
}
