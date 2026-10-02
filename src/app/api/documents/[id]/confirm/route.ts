import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { canAccessContact } from "@/lib/team";
import { confirmUpload, documentContact, getDocument } from "@/lib/documents";

/** Paso 2 de la subida: el navegador termino el PUT; el servidor verifica y publica. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const doc = await getDocument(id);
  const contact = doc ? await documentContact(doc) : null;
  if (!doc || !contact || !canAccessContact(auth.member, contact)) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const result = await confirmUpload(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
