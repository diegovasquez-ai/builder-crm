import { NextRequest, NextResponse } from "next/server";
import { emitContactCreated } from "@/lib/contacts/events";
import { db } from "@/db";
import { contacts, teamMembers } from "@/db/schema";
import { eq, like, or, desc, and, type SQL } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";
import { camposContacto } from "@/lib/config";
import { validarCamposPersonalizados } from "@/lib/config/campos";
import { ownerFilter } from "@/lib/team";
import { assignContact } from "@/lib/contacts/assign";

export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const source = searchParams.get("source");

  const conditions: SQL[] = [];

  // Un asesor ve solo lo suyo. Se filtra aca, en el servidor, no en la tabla.
  const visibility = ownerFilter(auth.member);
  if (visibility) conditions.push(visibility);

  if (search) {
    const searchCond = or(
      like(contacts.name, `%${search}%`),
      like(contacts.email, `%${search}%`),
      like(contacts.company, `%${search}%`)
    );
    if (searchCond) conditions.push(searchCond);
  }

  if (source) {
    conditions.push(eq(contacts.source, source));
  }

  const base = db
    .select({
      ...contactColumns(),
      ownerName: teamMembers.name,
      ownerEmail: teamMembers.email,
    })
    .from(contacts)
    .leftJoin(teamMembers, eq(teamMembers.id, contacts.ownerId));

  const results = await (conditions.length > 0
    ? base.where(and(...conditions)).orderBy(desc(contacts.createdAt))
    : base.orderBy(desc(contacts.createdAt)));

  return NextResponse.json(results);
}

/** Todas las columnas de `contacts`, para poder sumarle las del join. */
function contactColumns() {
  return {
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    phone: contacts.phone,
    company: contacts.company,
    source: contacts.source,
    score: contacts.score,
    notes: contacts.notes,
    tags: contacts.tags,
    aiEnabled: contacts.aiEnabled,
    needsHuman: contacts.needsHuman,
    needsHumanReason: contacts.needsHumanReason,
    needsHumanAt: contacts.needsHumanAt,
    ownerId: contacts.ownerId,
    assignedAt: contacts.assignedAt,
    tenantId: contacts.tenantId,
    createdAt: contacts.createdAt,
    updatedAt: contacts.updatedAt,
  };
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

  const { name, email, phone, company, source, score, notes, tags, ownerId, customFields } = body;

  if (!name) {
    return NextResponse.json(
      { error: "El nombre es requerido" },
      { status: 400 }
    );
  }

  const campos = validarCamposPersonalizados(camposContacto(), customFields);
  if (!campos.ok) {
    return NextResponse.json({ error: campos.error }, { status: 400 });
  }

  const tagsValue = Array.isArray(tags)
    ? tags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0)
    : [];

  try {
    const now = new Date();
    const resultRows = await db
      .insert(contacts)
      .values({
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || "otro",
        score: score || 0,
        notes: notes || null,
        tags: tagsValue,
        customFields: campos.valores,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const result = resultRows[0];

    // Un asesor que crea un contacto se lo queda; el admin elige (o lo deja libre).
    const owner =
      auth.member.role === "admin"
        ? typeof ownerId === "string" && ownerId
          ? ownerId
          : null
        : auth.member.id;
    if (owner) {
      await assignContact({
        contactId: result.id,
        ownerId: owner,
        by: { type: "member", member: auth.member },
      });
    }

    await emitContactCreated(result.id, { name: result.name, source: result.source });

    return NextResponse.json({ ...result, ownerId: owner }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Error al crear contacto: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
