import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { resolveDefaultTenantId } from "@/lib/tenants";
import { flattenTemplateParams } from "@/lib/whatsapp-templates";
import { deliverMessage } from "@/lib/channels/deliver";
import {
  findConversationForContact,
  ingestMessage,
  upsertConversation,
} from "@/lib/channels/ingest";
import { getAccountForChannel } from "@/lib/channels/accounts";
import { whatsappProvider } from "@/lib/channels/provider";
import { requireMember } from "@/lib/api-auth";

/**
 * Envio de WhatsApp identificando al destinatario por TELEFONO.
 *
 * Existe aparte de `/api/messages/send` (que va por conversacion) porque hay un caso que
 * no se puede expresar por hilo: escribirle a un numero con el que todavia no hay
 * conversacion. WhatsApp no permite abrir con texto libre, asi que ese camino exige
 * plantilla y en Zernio se resuelve con `POST /v1/inbox/conversations`.
 */

interface SendBody {
  to: string;
  contactId?: string;
  text?: string;
  template?: {
    name: string;
    language?: string;
    components?: unknown[];
    /** Texto ya renderizado (variables rellenas) para mostrar en el chat. */
    previewText?: string;
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!body.to) {
    return NextResponse.json(
      { error: "Campo 'to' requerido (numero E.164, ej +5491134567890)" },
      { status: 400 }
    );
  }
  if (!body.text && !body.template) {
    return NextResponse.json(
      { error: "Tenes que enviar 'text' (texto libre) o 'template' (plantilla)" },
      { status: 400 }
    );
  }

  const normalizedTo = `+${normalizePhone(body.to)}`;
  const tenantId = await resolveDefaultTenantId();

  const contactId =
    body.contactId ?? (await findOrCreateContactByPhone(normalizedTo, tenantId));

  const existing = await findConversationForContact(contactId, "whatsapp");

  // Hilo abierto: sale por el camino comun (adapter + persistencia unificada).
  if (existing) {
    const result = await deliverMessage(
      existing.id,
      body.template
        ? {
            template: {
              name: body.template.name,
              language: body.template.language ?? "es",
              components: body.template.components ?? [],
              previewText: body.template.previewText,
            },
          }
        : { text: body.text },
      body.template ? "template" : "human"
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, hint: result.hint, messageId: result.messageId },
        { status: 502 }
      );
    }

    await touchContact(contactId);
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      externalId: result.externalId,
      conversationId: existing.id,
    });
  }

  if (whatsappProvider() === "meta") {
    return NextResponse.json(
      {
        error:
          "No hay conversacion abierta y WHATSAPP_PROVIDER=meta. Volve a poner el proveedor en zernio para poder iniciar conversaciones.",
      },
      { status: 409 }
    );
  }

  return openConversation({
    contactId,
    tenantId,
    to: normalizedTo,
    body,
  });
}

/**
 * Primer contacto con un numero. WhatsApp exige plantilla aprobada para abrir hilo;
 * sin ella Zernio devuelve TEMPLATE_REQUIRED.
 */
async function openConversation(args: {
  contactId: string;
  tenantId: string | null;
  to: string;
  body: SendBody;
}): Promise<NextResponse> {
  const { contactId, tenantId, to, body } = args;

  if (!body.template) {
    return NextResponse.json(
      {
        error: "No hay conversacion abierta con este numero",
        hint: "WhatsApp no permite abrir una conversacion con texto libre. Enviá una plantilla aprobada.",
      },
      { status: 409 }
    );
  }

  const account = await getAccountForChannel(tenantId, "whatsapp");
  if (!account?.zernioAccountId) {
    return NextResponse.json(
      {
        error: "No hay cuenta de WhatsApp conectada en Zernio",
        hint: "Conectala con `npm run zernio:whatsapp` o desde Ajustes > Canales.",
      },
      { status: 409 }
    );
  }

  const { createConversation } = await import("@/lib/zernio/inbox");
  const result = await createConversation({
    accountId: account.zernioAccountId,
    // Zernio espera el telefono internacional sin el `+`.
    participantId: to.replace(/^\+/, ""),
    templateName: body.template.name,
    templateLanguage: body.template.language ?? "es",
    templateParams: flattenTemplateParams(body.template.components),
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error.message,
        hint:
          result.error.code === "TEMPLATE_REQUIRED"
            ? "La plantilla no fue aceptada. Revisá que esté APPROVED y que la cantidad de variables coincida."
            : undefined,
      },
      { status: 502 }
    );
  }

  const externalId = result.data.conversationId ?? result.data.id;
  if (!externalId) {
    return NextResponse.json(
      { success: false, error: "Zernio no devolvio conversationId" },
      { status: 502 }
    );
  }

  // Se refleja localmente para que el chat lo muestre ya. El webhook
  // `conversation.started` / `message.sent` hace el mismo upsert, es idempotente.
  const conversation = await upsertConversation({
    tenantId: tenantId ?? "",
    contactId,
    accountId: account.id,
    channel: "whatsapp",
    provider: "zernio",
    externalId,
    participantId: to,
  });

  const preview =
    body.template.previewText?.trim() || `[plantilla] ${body.template.name}`;

  await ingestMessage({
    conversation,
    direction: "out",
    externalId: result.data.messageId ?? null,
    body: preview,
    type: "template",
    status: "sent",
    rawPayload: result.data,
  });

  await touchContact(contactId);

  return NextResponse.json({
    success: true,
    conversationId: conversation.id,
    externalId: result.data.messageId ?? null,
  });
}

async function touchContact(contactId: string): Promise<void> {
  await db
    .update(contacts)
    .set({ updatedAt: new Date() })
    .where(eq(contacts.id, contactId));
}

async function findOrCreateContactByPhone(
  phone: string,
  tenantId: string | null
): Promise<string> {
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.phone, phone))
    .limit(1);
  if (existing) return existing.id;

  const now = new Date();
  const [created] = await db
    .insert(contacts)
    .values({
      name: `WhatsApp ${phone.slice(-4)}`,
      phone,
      source: "whatsapp",
      tenantId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: contacts.id });

  await db.insert(activities).values({
    type: "note",
    description: "Contacto creado al enviar primer WhatsApp saliente",
    contactId: created.id,
    createdAt: now,
  });

  return created.id;
}
