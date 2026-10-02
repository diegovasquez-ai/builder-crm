import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { canAccessContact } from "@/lib/team";
import { deleteDocument, documentContact, getDocument } from "@/lib/documents";

export async function DELETE(
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

  try {
    await deleteDocument(id);
  } catch (err) {
    console.error("[documents] delete fallo", id, err);
    return NextResponse.json({ error: "No se pudo borrar del almacenamiento" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
