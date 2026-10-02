import "server-only";
import { db } from "@/db";
import { contacts, deals, documents, pipelineStages, teamMembers } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  deleteObject,
  deleteObjects,
  objectSize,
  safeFilename,
  signDownload,
  signUpload,
} from "@/lib/storage";

/**
 * Documentos de la ficha. Subida en dos pasos:
 *
 *   1. `beginUpload`  -> fila `pending` + URL firmada. El navegador hace PUT al bucket.
 *   2. `confirmUpload` -> el servidor verifica que el objeto existe (HEAD) y marca `ready`.
 *
 * Solo se listan los `ready`. Un `pending` es una subida que se corto; no molesta a
 * nadie y se puede limpiar cuando se quiera.
 *
 * Quien puede ver un documento es quien puede ver el contacto: la visibilidad la
 * decide `canAccessContact` en la ruta, no aca.
 */

export interface DocumentItem {
  id: string;
  contactId: string;
  dealId: string | null;
  dealTitle: string | null;
  stageName: string | null;
  name: string;
  mime: string;
  size: number;
  uploadedBy: string | null;
  createdAt: Date;
}

export async function listDocuments(contactId: string): Promise<DocumentItem[]> {
  const rows = await db
    .select({
      id: documents.id,
      contactId: documents.contactId,
      dealId: documents.dealId,
      dealTitle: deals.title,
      stageName: pipelineStages.name,
      name: documents.name,
      mime: documents.mime,
      size: documents.size,
      uploadedBy: sql<string | null>`coalesce(${teamMembers.name}, split_part(${teamMembers.email}, '@', 1))`,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .leftJoin(deals, eq(documents.dealId, deals.id))
    .leftJoin(pipelineStages, eq(documents.stageId, pipelineStages.id))
    .leftJoin(teamMembers, eq(documents.uploadedBy, teamMembers.id))
    .where(and(eq(documents.contactId, contactId), eq(documents.status, "ready")))
    .orderBy(desc(documents.createdAt));
  return rows;
}

/** Cuantos documentos listos tiene cada contacto (para el contador del kanban). */
export async function countDocumentsByContact(
  contactIds: string[]
): Promise<Record<string, number>> {
  if (contactIds.length === 0) return {};
  const rows = await db
    .select({ contactId: documents.contactId, n: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(inArray(documents.contactId, contactIds), eq(documents.status, "ready")))
    .groupBy(documents.contactId);
  return Object.fromEntries(rows.map((r) => [r.contactId, r.n]));
}

export interface BeginUploadInput {
  contactId: string;
  name: string;
  mime: string;
  size: number;
  /** Operacion a la que se asocia; si no viene y el contacto tiene una sola, se usa esa. */
  dealId?: string | null;
  memberId: string;
}

export type BeginUploadResult =
  | { ok: true; id: string; uploadUrl: string }
  | { ok: false; error: string };

export async function beginUpload(input: BeginUploadInput): Promise<BeginUploadResult> {
  if (!ALLOWED_MIME[input.mime]) {
    return { ok: false, error: "Solo se aceptan PDF e imagenes (JPG, PNG, WebP)." };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Archivo vacio." };
  }
  if (input.size > MAX_FILE_BYTES) {
    return { ok: false, error: `El archivo supera los ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  }

  // Foto de operacion + etapa en el momento de la subida.
  let dealId = input.dealId ?? null;
  let stageId: string | null = null;
  const contactDeals = await db
    .select({ id: deals.id, stageId: deals.stageId })
    .from(deals)
    .where(eq(deals.contactId, input.contactId));
  if (dealId && !contactDeals.some((d) => d.id === dealId)) dealId = null;
  if (!dealId && contactDeals.length === 1) dealId = contactDeals[0].id;
  if (dealId) stageId = contactDeals.find((d) => d.id === dealId)?.stageId ?? null;

  const id = crypto.randomUUID();
  const filename = safeFilename(input.name, input.mime);
  const storageKey = `contacts/${input.contactId}/${id}/${filename}`;

  await db.insert(documents).values({
    id,
    contactId: input.contactId,
    dealId,
    stageId,
    name: input.name.trim().slice(0, 200) || filename,
    mime: input.mime,
    size: input.size,
    storageKey,
    status: "pending",
    uploadedBy: input.memberId,
  });

  const uploadUrl = await signUpload(storageKey, input.mime);
  return { ok: true, id, uploadUrl };
}

export type ConfirmResult = { ok: true } | { ok: false; error: string };

/** Marca `ready` si el objeto esta en el bucket. Si no, borra la fila: la subida fallo. */
export async function confirmUpload(id: string): Promise<ConfirmResult> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return { ok: false, error: "Documento no encontrado" };
  if (doc.status === "ready") return { ok: true };

  const size = await objectSize(doc.storageKey);
  if (size === null) {
    await db.delete(documents).where(eq(documents.id, id));
    return { ok: false, error: "El archivo no llego al bucket. Intenta de nuevo." };
  }
  if (size > MAX_FILE_BYTES) {
    // Alguien firmo con un tamano y subio otro: fuera.
    await deleteObject(doc.storageKey).catch(() => {});
    await db.delete(documents).where(eq(documents.id, id));
    return { ok: false, error: "El archivo supera el tamano permitido." };
  }

  await db.update(documents).set({ status: "ready", size }).where(eq(documents.id, id));
  return { ok: true };
}

export async function getDocument(id: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return doc ?? null;
}

export async function documentDownloadUrl(
  doc: { storageKey: string; name: string; mime: string },
  inline: boolean
): Promise<string> {
  return signDownload(doc.storageKey, { filename: doc.name, mime: doc.mime, inline });
}

export async function deleteDocument(id: string): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  // Primero el objeto: si falla, la fila queda y se puede reintentar. Al reves, el
  // archivo quedaria huerfano en el bucket sin nadie que lo referencie.
  await deleteObject(doc.storageKey);
  await db.delete(documents).where(eq(documents.id, id));
}

/**
 * Borra del bucket todo lo del contacto. Llamar ANTES de borrar el contacto: la fila
 * se va por cascade, el objeto no. Best-effort: si el bucket no responde, el contacto
 * se borra igual y quedan objetos huerfanos, que es preferible a no poder borrar.
 */
export async function purgeContactDocuments(contactId: string): Promise<void> {
  const rows = await db
    .select({ key: documents.storageKey })
    .from(documents)
    .where(eq(documents.contactId, contactId));
  if (rows.length === 0) return;
  try {
    await deleteObjects(rows.map((r) => r.key));
  } catch (err) {
    console.error("[documents] purge fallo para contacto", contactId, err);
  }
}

/** Contacto del documento, para la guarda de acceso en las rutas. */
export async function documentContact(doc: { contactId: string }) {
  const [c] = await db
    .select({ id: contacts.id, ownerId: contacts.ownerId })
    .from(contacts)
    .where(eq(contacts.id, doc.contactId))
    .limit(1);
  return c ?? null;
}
