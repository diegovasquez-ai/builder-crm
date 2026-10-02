import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/api-auth";
import { canAccessContact, type TeamMember } from "@/lib/team";
import { beginUpload, listDocuments } from "@/lib/documents";
import { storageConfigured } from "@/lib/storage";

async function accessibleContact(member: TeamMember, contactId: string) {
  const [contact] = await db
    .select({ id: contacts.id, ownerId: contacts.ownerId })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  // Ajeno = inexistente.
  if (!contact || !canAccessContact(member, contact)) return null;
  return contact;
}

/** GET /api/documents?contactId=... — documentos listos de un contacto visible. */
export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  const contactId = request.nextUrl.searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId requerido" }, { status: 400 });
  if (!(await accessibleContact(auth.member, contactId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  const items = await listDocuments(contactId);
  return NextResponse.json({ items, storage: storageConfigured() });
}

/**
 * POST /api/documents — paso 1 de la subida: valida, crea la fila `pending` y devuelve
 * la URL firmada. El archivo va del navegador al bucket; por aca no pasa.
 */
export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "El almacenamiento de archivos no esta configurado (variables S3_*)." },
      { status: 503 }
    );
  }

  let body: { contactId?: string; name?: string; mime?: string; size?: number; dealId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  if (!body.contactId || !body.name || !body.mime || typeof body.size !== "number") {
    return NextResponse.json({ error: "Faltan contactId, name, mime o size" }, { status: 400 });
  }
  if (!(await accessibleContact(auth.member, body.contactId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  const result = await beginUpload({
    contactId: body.contactId,
    name: body.name,
    mime: body.mime,
    size: body.size,
    dealId: body.dealId ?? null,
    memberId: auth.member.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id, uploadUrl: result.uploadUrl }, { status: 201 });
}
