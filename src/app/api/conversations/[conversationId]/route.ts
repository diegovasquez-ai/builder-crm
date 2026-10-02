import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { canAccessContact } from "@/lib/team";
import { deleteConversation, getConversation } from "@/lib/conversations";

/**
 * DELETE /api/conversations/:id — borra el hilo y sus mensajes.
 *
 * Solo admin: un asesor no deberia poder borrar historial de atencion, ni siquiera el
 * de sus propios contactos. Un hilo que el admin no puede ver responde 404, igual que
 * el resto de las rutas.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { conversationId } = await params;

  const { conversation, contact } = await getConversation(conversationId);
  const accesible = contact ? canAccessContact(auth.member, contact) : true;
  if (!conversation || !accesible) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  const result = await deleteConversation(conversationId);
  if (!result.deleted) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ success: true, messages: result.messages });
}
