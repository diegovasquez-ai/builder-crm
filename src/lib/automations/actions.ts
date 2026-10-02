import "server-only";
import { db } from "@/db";
import { activities, contacts, pipelineStages, pipelines } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { notifyMember } from "@/lib/notifications";
import { resolveConversationId } from "@/lib/conversations";
import { displayName, getMember, listMembers } from "@/lib/team";
import { assignContact } from "@/lib/contacts/assign";
import { SOURCE_LABELS } from "@/lib/constants";
import type { LeadSource } from "@/types";
import type {
  AutomationEvent,
  ContactAssignedPayload,
  SelectOption,
} from "./triggers";

/**
 * Catalogo de acciones: QUE puede hacer una regla. Cada accion declara sus parametros
 * (para que el constructor dibuje el formulario) y como se ejecuta.
 *
 * Para agregar una: una entrada en `ACTIONS`. Nada mas.
 */

export type ActionKey = "push" | "add_tag" | "remove_tag" | "assign_owner" | "create_activity";

export interface ActionParam {
  key: string;
  label: string;
  type: "select" | "text" | "textarea";
  required?: boolean;
  placeholder?: string;
  /** Solo `select`. */
  options?: () => Promise<SelectOption[]>;
  /** Solo texto: acepta {{placeholders}} del disparador. */
  templated?: boolean;
}

export interface ActionSpec {
  type: ActionKey;
  params: Record<string, string>;
}

export type ActionOutcome = { status: "done" | "skipped"; detail: string };

export interface ActionContext {
  event: AutomationEvent;
  contactId: string;
  /** Reemplaza {{contacto}}, {{asesor}}, {{etapa}}... segun el disparador. */
  render: (template: string) => Promise<string>;
}

export interface ActionDef {
  key: ActionKey;
  label: string;
  description: string;
  params: ActionParam[];
  run: (ctx: ActionContext, params: Record<string, string>) => Promise<ActionOutcome>;
}

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

/**
 * Construye el `render` de un run: resuelve cada placeholder una sola vez, y solo si
 * alguna accion lo usa (lazy).
 */
export function buildRenderer(event: AutomationEvent, contactId: string) {
  const cache = new Map<string, Promise<string>>();

  const resolve = (name: string): Promise<string> => {
    if (!cache.has(name)) cache.set(name, compute(name));
    return cache.get(name)!;
  };

  const compute = async (name: string): Promise<string> => {
    const p = event.payload;
    switch (name) {
      case "contacto": {
        if (typeof p.contactName === "string" && p.contactName) return p.contactName;
        const [c] = await db
          .select({ name: contacts.name })
          .from(contacts)
          .where(eq(contacts.id, contactId))
          .limit(1);
        return c?.name ?? "el contacto";
      }
      case "asesor": {
        const ownerId =
          typeof p.ownerId === "string"
            ? p.ownerId
            : (
                await db
                  .select({ ownerId: contacts.ownerId })
                  .from(contacts)
                  .where(eq(contacts.id, contactId))
                  .limit(1)
              )[0]?.ownerId;
        if (!ownerId) return "sin asesor";
        const m = await getMember(ownerId);
        return m ? displayName(m) : "sin asesor";
      }
      case "quien": {
        const by = (p as unknown as ContactAssignedPayload).assignedBy;
        if (!by) return "";
        return by.type === "agent" ? "el agente de IA" : by.name;
      }
      case "etapa":
        return typeof p.stageName === "string" ? p.stageName : "";
      case "etapa_anterior":
        return typeof p.previousStageName === "string" ? p.previousStageName : "";
      case "pipeline":
        return typeof p.pipelineName === "string" ? p.pipelineName : "";
      case "operacion":
        return typeof p.dealTitle === "string" ? p.dealTitle : "";
      case "fuente": {
        const src = typeof p.source === "string" ? p.source : "";
        return SOURCE_LABELS[src as LeadSource] ?? src;
      }
      default:
        return "";
    }
  };

  return async (template: string): Promise<string> => {
    const names = [...template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    const values = new Map<string, string>();
    for (const n of new Set(names)) values.set(n, await resolve(n));
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, n: string) => values.get(n) ?? "");
  };
}

// ---------------------------------------------------------------------------
// Opciones compartidas
// ---------------------------------------------------------------------------

async function recipientOptions(): Promise<SelectOption[]> {
  const members = await listMembers({ onlyActive: true });
  return [
    { value: "owner", label: "Asesor asignado al contacto" },
    { value: "admins", label: "Todos los administradores" },
    ...members.map((m) => ({ value: `member:${m.id}`, label: displayName(m) })),
  ];
}

async function memberOptions(): Promise<SelectOption[]> {
  const members = await listMembers({ onlyActive: true });
  return members.map((m) => ({ value: m.id, label: displayName(m) }));
}

async function activityTypeOptions(): Promise<SelectOption[]> {
  return [
    { value: "note", label: "Nota" },
    { value: "follow_up", label: "Seguimiento" },
    { value: "call", label: "Llamada" },
    { value: "meeting", label: "Reunion" },
    { value: "email", label: "Email" },
  ];
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

const push: ActionDef = {
  key: "push",
  label: "Notificacion interna",
  description: "Push al telefono de un asesor, de los administradores o del asesor asignado.",
  params: [
    { key: "to", label: "Para", type: "select", required: true, options: recipientOptions },
    { key: "title", label: "Titulo", type: "text", required: true, templated: true, placeholder: "Nuevo lead en {{etapa}}" },
    { key: "body", label: "Texto", type: "textarea", required: true, templated: true, placeholder: "{{contacto}} entro a {{etapa}}" },
  ],
  async run(ctx, params) {
    const recipients: string[] = [];
    if (params.to === "owner") {
      const [c] = await db
        .select({ ownerId: contacts.ownerId })
        .from(contacts)
        .where(eq(contacts.id, ctx.contactId))
        .limit(1);
      if (!c?.ownerId) return { status: "skipped", detail: "El contacto no tiene asesor asignado" };
      recipients.push(c.ownerId);
    } else if (params.to === "admins") {
      const admins = (await listMembers({ onlyActive: true })).filter((m) => m.role === "admin");
      recipients.push(...admins.map((m) => m.id));
    } else if (params.to?.startsWith("member:")) {
      recipients.push(params.to.slice("member:".length));
    } else {
      return { status: "skipped", detail: "Destinatario invalido" };
    }

    const title = await ctx.render(params.title ?? "");
    const body = await ctx.render(params.body ?? "");
    // Al tocar el aviso se abre la conversacion (el hilo mas reciente del contacto):
    // el aviso es para atender al cliente. Sin hilo todavia, la ficha.
    const conversationId = await resolveConversationId(ctx.contactId);
    const url = conversationId
      ? `/conversations/${conversationId}`
      : `/contacts/${ctx.contactId}`;

    // Siempre queda la notificacion interna (campanita); el push llega si el asesor
    // activo un dispositivo. El detalle dice exactamente que paso con cada uno.
    const parts: string[] = [];
    let delivered = 0;
    for (const id of [...new Set(recipients)]) {
      const m = await getMember(id);
      if (!m || !m.active) continue;
      const out = await notifyMember({
        memberId: id,
        title,
        body,
        url,
        contactId: ctx.contactId,
        tag: `auto-${ctx.contactId}`,
      });
      delivered++;
      if ("error" in out.push) parts.push(`${displayName(m)}: en el CRM (push fallo: ${out.push.error})`);
      else if (out.push.noDevices) parts.push(`${displayName(m)}: en el CRM (sin push: no activo ningun dispositivo)`);
      else parts.push(`${displayName(m)}: en el CRM + push a ${out.push.sent} dispositivo${out.push.sent === 1 ? "" : "s"}`);
    }
    return delivered > 0
      ? { status: "done", detail: parts.join(" · ") }
      : { status: "skipped", detail: "Ningun destinatario activo" };
  },
};

const addTag: ActionDef = {
  key: "add_tag",
  label: "Agregar etiqueta",
  description: "Suma una etiqueta al contacto (si no la tiene ya).",
  params: [{ key: "tag", label: "Etiqueta", type: "text", required: true, placeholder: "urgente" }],
  async run(ctx, params) {
    const tag = (params.tag ?? "").trim();
    if (!tag) return { status: "skipped", detail: "Etiqueta vacia" };
    const [c] = await db
      .select({ tags: contacts.tags })
      .from(contacts)
      .where(eq(contacts.id, ctx.contactId))
      .limit(1);
    if (!c) return { status: "skipped", detail: "Contacto no encontrado" };
    if (c.tags.includes(tag)) return { status: "skipped", detail: `Ya tenia "${tag}"` };
    await db
      .update(contacts)
      .set({ tags: [...c.tags, tag], updatedAt: new Date() })
      .where(eq(contacts.id, ctx.contactId));
    return { status: "done", detail: `Etiqueta "${tag}" agregada` };
  },
};

const removeTag: ActionDef = {
  key: "remove_tag",
  label: "Quitar etiqueta",
  description: "Quita una etiqueta del contacto.",
  params: [{ key: "tag", label: "Etiqueta", type: "text", required: true }],
  async run(ctx, params) {
    const tag = (params.tag ?? "").trim();
    if (!tag) return { status: "skipped", detail: "Etiqueta vacia" };
    const [c] = await db
      .select({ tags: contacts.tags })
      .from(contacts)
      .where(eq(contacts.id, ctx.contactId))
      .limit(1);
    if (!c || !c.tags.includes(tag)) return { status: "skipped", detail: `No tenia "${tag}"` };
    await db
      .update(contacts)
      .set({ tags: c.tags.filter((t) => t !== tag), updatedAt: new Date() })
      .where(eq(contacts.id, ctx.contactId));
    return { status: "done", detail: `Etiqueta "${tag}" quitada` };
  },
};

const assignOwner: ActionDef = {
  key: "assign_owner",
  label: "Asignar asesor",
  description: "Pone a un asesor a cargo del contacto. Dispara a su vez \"Contacto asignado\".",
  params: [{ key: "memberId", label: "Asesor", type: "select", required: true, options: memberOptions }],
  async run(ctx, params) {
    if (!params.memberId) return { status: "skipped", detail: "Sin asesor elegido" };
    const r = await assignContact({
      contactId: ctx.contactId,
      ownerId: params.memberId,
      by: { type: "automation" },
      depth: (ctx.event.depth ?? 0) + 1,
    });
    if (!r.ok) return { status: "skipped", detail: r.error ?? "No se pudo asignar" };
    const name = r.owner ? displayName(r.owner) : "?";
    return r.unchanged
      ? { status: "skipped", detail: `Ya estaba asignado a ${name}` }
      : { status: "done", detail: `Asignado a ${name}` };
  },
};

const createActivity: ActionDef = {
  key: "create_activity",
  label: "Crear actividad",
  description: "Deja una nota o un seguimiento en el historial del contacto.",
  params: [
    { key: "type", label: "Tipo", type: "select", required: true, options: activityTypeOptions },
    { key: "description", label: "Descripcion", type: "textarea", required: true, templated: true, placeholder: "Llamar a {{contacto}} por {{etapa}}" },
  ],
  async run(ctx, params) {
    const description = (await ctx.render(params.description ?? "")).trim();
    if (!description) return { status: "skipped", detail: "Descripcion vacia" };
    await db.insert(activities).values({
      type: params.type || "note",
      description,
      contactId: ctx.contactId,
    });
    return { status: "done", detail: `Actividad creada: ${description.slice(0, 60)}` };
  },
};

export const ACTIONS: ActionDef[] = [push, addTag, removeTag, assignOwner, createActivity];

export function actionFor(key: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.key === key);
}

/** Normaliza lo que llega del cliente a acciones validas (tipo conocido, params string). */
export function sanitizeActions(raw: unknown): { actions: ActionSpec[]; errors: string[] } {
  const actions: ActionSpec[] = [];
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { actions, errors };

  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const { type, params } = item as Record<string, unknown>;
    const def = typeof type === "string" ? actionFor(type) : undefined;
    if (!def) {
      errors.push(`Accion ${i + 1}: tipo desconocido`);
      return;
    }
    const clean: Record<string, string> = {};
    const src = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
    for (const p of def.params) {
      const v = src[p.key];
      clean[p.key] = typeof v === "string" ? v : "";
      if (p.required && !clean[p.key].trim()) {
        errors.push(`${def.label}: falta "${p.label}"`);
      }
    }
    actions.push({ type: def.key, params: clean });
  });

  return { actions, errors };
}

/** Texto corto para la lista: "Push al asesor asignado, Etiqueta \"urgente\"". */
export async function describeActions(actions: ActionSpec[]): Promise<string> {
  const parts: string[] = [];
  for (const a of actions) {
    const def = actionFor(a.type);
    if (!def) continue;
    switch (a.type) {
      case "push": {
        const to = a.params.to ?? "";
        let who = "asesor asignado";
        if (to === "admins") who = "administradores";
        else if (to.startsWith("member:")) {
          const m = await getMember(to.slice(7));
          who = m ? displayName(m) : "asesor";
        }
        parts.push(`Push a ${who}`);
        break;
      }
      case "add_tag":
        parts.push(`Etiqueta "${a.params.tag}"`);
        break;
      case "remove_tag":
        parts.push(`Quitar "${a.params.tag}"`);
        break;
      case "assign_owner": {
        const m = a.params.memberId ? await getMember(a.params.memberId) : null;
        parts.push(`Asignar a ${m ? displayName(m) : "asesor"}`);
        break;
      }
      case "create_activity":
        parts.push("Crear actividad");
        break;
    }
  }
  return parts.join(" · ");
}

/** Nombre legible de una etapa, para el resumen de filtros. */
export async function stageLabel(stageId: string): Promise<string> {
  const [s] = await db
    .select({ name: pipelineStages.name, pipelineId: pipelineStages.pipelineId })
    .from(pipelineStages)
    .where(eq(pipelineStages.id, stageId))
    .limit(1);
  if (!s) return "etapa";
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(pipelines);
  if (n <= 1) return s.name;
  const [p] = await db
    .select({ name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.id, s.pipelineId))
    .limit(1);
  return p ? `${p.name} › ${s.name}` : s.name;
}
