import { NextRequest, NextResponse } from "next/server";
import { deliverMessage } from "@/lib/channels/deliver";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessContactId } from "@/lib/team";
import { requireMember } from "@/lib/api-auth";

/**
 * Envio generico por conversacion: sirve para WhatsApp, Instagram y Messenger.
 * Reemplaza al `/api/whatsapp/send` del chat, que razonaba por telefono y por eso
 * bloqueaba los canales donde no hay telefono.
 */

export const dynamic = "force-dynamic";

interface SendBody {
  conversationId?: string;
  text?: string;
  template?: {
    name: string;
    language?: string;
    components?: unknown[];
    previewText?: string;
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { member } = auth;
  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!body.conversationId) {
    return NextResponse.json(
      { error: "Campo 'conversationId' requerido" },
      { status: 400 }
    );
  }
  if (!body.text?.trim() && !body.template) {
    return NextResponse.json(
      { error: "Tenes que enviar 'text' o 'template'" },
      { status: 400 }
    );
  }

  // Un asesor solo escribe en hilos de sus contactos (404: no se confirma que exista).
  const [conv] = await db
    .select({ contactId: conversations.contactId })
    .from(conversations)
    .where(eq(conversations.id, body.conversationId))
    .limit(1);
  if (!conv || (conv.contactId && !(await canAccessContactId(member, conv.contactId)))) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  const result = await deliverMessage(
    body.conversationId,
    body.template ? { template: body.template } : { text: body.text },
    body.template ? "template" : "human"
  );

  if (!result.ok) {
    const status = result.error === "conversation_not_found" ? 404 : 502;
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        hint: result.hint,
        messageId: result.messageId,
      },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    externalId: result.externalId,
  });
}
