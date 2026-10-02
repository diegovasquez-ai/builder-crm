import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/db";
import { contacts, activities, messages } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/meta-whatsapp";
import { enqueueAgentJob, queueConfig } from "@/lib/agent/queue";
import { resolveRealPhone, normalizePhone } from "@/lib/phone";
import {
  getAccountByPhoneNumberId,
  type WhatsappAccount,
} from "@/lib/whatsapp-accounts";
import { touchConversation, upsertConversation } from "@/lib/channels/ingest";
import { metaWebhookActive } from "@/lib/channels/provider";

const REACTIVATION_INACTIVITY_DAYS = 7;
const REACTIVATION_INACTIVITY_MS = REACTIVATION_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

/**
 * Handshake de Meta: cuando configuras el webhook, Meta hace un GET con
 * `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`. Si el token
 * coincide con el que tenes en .env, devolves el challenge en text/plain.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[whatsapp-webhook] handshake fallido", { mode, tokenMatches: token === VERIFY_TOKEN });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; caption?: string; mime_type: string };
  document?: { id: string; filename?: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string };
  contacts?: unknown[];
}

interface MetaContactProfile {
  wa_id: string;
  profile?: { name?: string };
}

interface MetaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

interface MetaWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product?: string;
        metadata?: { display_phone_number: string; phone_number_id: string };
        contacts?: MetaContactProfile[];
        messages?: MetaInboundMessage[];
        statuses?: MetaStatus[];
      };
    }>;
  }>;
}

function extractMessageBody(msg: MetaInboundMessage): string {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? "";
    case "image":
      return msg.image?.caption ? `[imagen] ${msg.image.caption}` : "[imagen]";
    case "audio":
      return "[audio]";
    case "video":
      return msg.video?.caption ? `[video] ${msg.video.caption}` : "[video]";
    case "document":
      return msg.document?.filename
        ? `[documento] ${msg.document.filename}`
        : "[documento]";
    case "location":
      return `[ubicacion] ${msg.location?.name ?? `${msg.location?.latitude},${msg.location?.longitude}`}`;
    default:
      return `[${msg.type}]`;
  }
}

function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  return /^WhatsApp\s+\w{2,6}$/i.test(name.trim());
}

async function findOrCreateContact(
  phone: string,
  tenantId: string,
  profileName?: string
): Promise<string> {
  const formatted = phone.startsWith("+") ? phone : `+${phone}`;
  const cleanProfileName = profileName?.trim() || undefined;

  const existingRows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.phone, formatted), eq(contacts.tenantId, tenantId)))
    .limit(1);
  const existing = existingRows[0];

  if (existing) {
    if (cleanProfileName && isPlaceholderName(existing.name)) {
      await db
        .update(contacts)
        .set({ name: cleanProfileName, updatedAt: new Date() })
        .where(eq(contacts.id, existing.id));
    }
    return existing.id;
  }

  const now = new Date();
  const placeholderName =
    cleanProfileName || `WhatsApp ${formatted.slice(-4)}`;

  const createdRows = await db
    .insert(contacts)
    .values({
      name: placeholderName,
      phone: formatted,
      source: "whatsapp",
      score: 50,
      tenantId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const created = createdRows[0];

  // Log activity
  await db.insert(activities).values({
    type: "note",
    description: "Nuevo contacto via WhatsApp (escribio primero)",
    contactId: created.id,
    createdAt: now,
  });

  return created.id;
}

/**
 * Si el bot esta apagado y no hay actividad en >REACTIVATION_INACTIVITY_DAYS dias,
 * reactivar bot automaticamente. La inactividad se mide contra el ultimo mensaje
 * registrado del contacto (cualquier direccion). Si el cliente nunca volvio a
 * escribir en una semana, asumimos que el ciclo con el asesor termino y el bot
 * vuelve a hacerse cargo.
 */
async function maybeReactivateAfterInactivity(contactId: string): Promise<void> {
  const [contact] = await db
    .select({
      aiEnabled: contacts.aiEnabled,
      needsHuman: contacts.needsHuman,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) return;
  if (contact.aiEnabled && !contact.needsHuman) return;

  const [lastMsg] = await db
    .select({
      sentAt: messages.sentAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.contactId, contactId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  if (!lastMsg) return;

  const lastTs = (lastMsg.sentAt ?? lastMsg.createdAt)?.getTime();
  if (!lastTs) return;

  const elapsed = Date.now() - lastTs;
  if (elapsed < REACTIVATION_INACTIVITY_MS) return;

  await db
    .update(contacts)
    .set({
      aiEnabled: true,
      needsHuman: false,
      needsHumanReason: null,
      needsHumanAt: null,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId));

  await db.insert(activities).values({
    type: "note",
    description: `Bot reactivado automaticamente: ${REACTIVATION_INACTIVITY_DAYS} dias de inactividad.`,
    contactId,
  });
}

async function handleInboundMessage(
  msg: MetaInboundMessage,
  metadata: { display_phone_number: string; phone_number_id: string } | undefined,
  profile: MetaContactProfile | undefined,
  account: WhatsappAccount
): Promise<{ contactId: string; jobId: string } | null> {
  // Gotcha A: en Coexistence wa_id puede ser un BSUID; usar siempre el numero real
  // de messages[0].from. Gotcha B: normalizar troncal para no duplicar contactos.
  const realPhone = resolveRealPhone(profile?.wa_id, msg.from);
  const fromPhone = `+${realPhone}`;
  const toPhone = metadata?.display_phone_number
    ? `+${normalizePhone(metadata.display_phone_number)}`
    : null;

  // Idempotencia: si ya existe el meta_message_id, no insertar de nuevo
  const existingRows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.metaMessageId, msg.id))
    .limit(1);
  if (existingRows[0]) return null;

  const contactId = await findOrCreateContact(
    fromPhone,
    account.tenantId,
    profile?.profile?.name
  );

  // Si el bot esta apagado pero ya pasaron 7 dias desde el ultimo mensaje,
  // reactivarlo antes de insertar el mensaje nuevo (asi el agente lo procesa).
  await maybeReactivateAfterInactivity(contactId);

  const sentAt = new Date(parseInt(msg.timestamp, 10) * 1000);
  const body = extractMessageBody(msg);

  // La conversacion es ahora la unidad del inbox y del agente: sin engancharla, este
  // mensaje no aparece en la lista ni entra en el historial que lee el bot.
  // `legacy:<contactId>` es el mismo external_id que uso el backfill de la migracion,
  // asi que este upsert cae sobre la fila existente en vez de crear un hilo nuevo.
  const conversation = await upsertConversation({
    tenantId: account.tenantId,
    contactId,
    accountId: null,
    channel: "whatsapp",
    provider: "meta",
    externalId: `legacy:${contactId}`,
    participantId: fromPhone,
    participantName: profile?.profile?.name ?? null,
  });

  await db.insert(messages).values({
    contactId,
    conversationId: conversation.id,
    channel: "whatsapp",
    provider: "meta",
    direction: "in",
    type: msg.type,
    body,
    metaMessageId: msg.id,
    externalId: msg.id,
    status: "received",
    rawPayload: msg,
    fromPhone,
    toPhone,
    tenantId: account.tenantId,
    sentAt,
    createdAt: new Date(),
  });

  await touchConversation(conversation.id, { direction: "in", body, sentAt });

  // Touch contact updatedAt para que ordene primero en la lista
  await db
    .update(contacts)
    .set({ updatedAt: new Date() })
    .where(eq(contacts.id, contactId));

  // Encolar job para el agente IA (debounce + skip si ai_enabled=false)
  const enqueued = await enqueueAgentJob(contactId, msg.id, conversation.id);
  return { contactId, jobId: enqueued.jobId };
}

async function handleStatusUpdate(status: MetaStatus) {
  const targetRows = await db
    .select()
    .from(messages)
    .where(eq(messages.metaMessageId, status.id))
    .limit(1);
  const target = targetRows[0];

  if (!target) return;

  const ts = new Date(parseInt(status.timestamp, 10) * 1000);
  const updates: Partial<typeof messages.$inferInsert> = {
    status: status.status,
  };

  if (status.status === "delivered") updates.deliveredAt = ts;
  if (status.status === "read") updates.readAt = ts;
  if (status.status === "failed") {
    updates.errorMessage = JSON.stringify(status.errors ?? []);
  }

  await db
    .update(messages)
    .set(updates)
    .where(eq(messages.id, target.id));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[whatsapp-webhook] firma invalida");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    // Devolver 200 igual: Meta retira el webhook si responde mal
    return NextResponse.json({ ignored: true });
  }

  // WhatsApp sale por Zernio. Este handler queda como valvula de escape
  // (WHATSAPP_PROVIDER=meta) y no procesa nada mientras Zernio sea el proveedor: si los
  // dos caminos ingestaran el mismo mensaje, el agente contestaria dos veces.
  if (!metaWebhookActive()) {
    return NextResponse.json({ ignored: true, reason: "whatsapp_provider=zernio" });
  }

  const enqueuedJobs: Array<{ contactId: string; jobId: string }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;

      // Routing por phone_number_id: SOLO procesamos numeros de nuestra tabla.
      // Cualquier otro numero que comparta la Meta App se ignora con
      // 200 para no robarle/duplicarle mensajes ni crear contactos basura.
      const account = await getAccountByPhoneNumberId(
        value.metadata?.phone_number_id
      );
      if (!account) {
        console.warn(
          "[whatsapp-webhook] phone_number_id no registrado, ignorando:",
          value.metadata?.phone_number_id
        );
        continue;
      }

      const profile = value.contacts?.[0];

      for (const msg of value.messages ?? []) {
        try {
          const result = await handleInboundMessage(
            msg,
            value.metadata,
            profile,
            account
          );
          if (result) enqueuedJobs.push(result);
        } catch (err) {
          console.error("[whatsapp-webhook] error mensaje entrante", err);
        }
      }

      for (const status of value.statuses ?? []) {
        try {
          await handleStatusUpdate(status);
        } catch (err) {
          console.error("[whatsapp-webhook] error status", err);
        }
      }
    }
  }

  // Disparar el worker del agente IA despues de devolver 200 OK.
  // Cada job hace su propio debounce: si llegan mas mensajes en los proximos
  // 6s del mismo contacto, el worker se ejecuta pero claimAgentJob detecta
  // debounce_still_active y se sale; el siguiente setTimeout va a procesar.
  if (enqueuedJobs.length > 0) {
    after(async () => {
      const uniqueJobIds = Array.from(
        new Set(enqueuedJobs.map((j) => j.jobId))
      );
      const baseUrl = getWorkerBaseUrl(request);
      const secret = process.env.AGENT_WORKER_SECRET;

      await Promise.all(
        uniqueJobIds.map(async (jobId) => {
          await new Promise((r) => setTimeout(r, queueConfig.debounceMs + 250));
          try {
            const res = await fetch(`${baseUrl}/api/agent/process`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(secret ? { "x-agent-secret": secret } : {}),
              },
              body: JSON.stringify({ jobId }),
            });
            if (!res.ok) {
              console.warn(
                "[whatsapp-webhook] agent worker no-200",
                res.status,
                await res.text().catch(() => "")
              );
            }
          } catch (err) {
            console.error("[whatsapp-webhook] error disparando worker", err);
          }
        })
      );
    });
  }

  // Meta espera 200 OK; si tarda demasiado o devuelve error retira el webhook
  return NextResponse.json({ received: true });
}

function getWorkerBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}
