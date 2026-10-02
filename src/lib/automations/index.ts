import "server-only";
import { after } from "next/server";
import { db } from "@/db";
import { automationRuns, automations, contacts } from "@/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  MAX_EVENT_DEPTH,
  TRIGGERS,
  evaluateFilters,
  sanitizeFilters,
  triggerFor,
  type AutomationEvent,
  type AutomationFilter,
  type TriggerKey,
} from "./triggers";
import {
  ACTIONS,
  actionFor,
  buildRenderer,
  describeActions,
  sanitizeActions,
  stageLabel,
  type ActionSpec,
} from "./actions";
import { displayName, getMember } from "@/lib/team";
import { SOURCE_LABELS } from "@/lib/constants";
import { CHANNEL_LABELS, isChannel } from "@/lib/channels/types";
import type { LeadSource } from "@/types";

/**
 * Motor de automatizaciones.
 *
 * Una regla = disparador + filtros + cadena de acciones, guardada en `automations`.
 * Cuando pasa algo, `emitAutomationEvent` busca las reglas activas de ese disparador,
 * evalua sus filtros contra el payload, y por cada una que pasa crea un run `pending`.
 * El run se procesa en `after()` (fuera de la request) y el sweeper
 * `GET /api/automations/process` retoma lo que quedo colgado. `automation_runs` es a
 * la vez la cola y el historial.
 */

const MAX_ATTEMPTS = 3;
const STALE_AFTER_MS = 60 * 1000;

export async function emitAutomationEvent(event: AutomationEvent): Promise<string[]> {
  const depth = event.depth ?? 0;
  if (depth > MAX_EVENT_DEPTH) {
    console.warn(`[automations] evento ${event.trigger} ignorado: profundidad ${depth}`);
    return [];
  }

  const candidates = await db
    .select({ key: automations.key, filters: automations.filters })
    .from(automations)
    .where(and(eq(automations.trigger, event.trigger), eq(automations.enabled, true)));

  const matched = candidates.filter((r) =>
    evaluateFilters(r.filters as AutomationFilter[], event.payload)
  );
  if (matched.length === 0) return [];

  const rows = await db
    .insert(automationRuns)
    .values(
      matched.map((r) => ({
        automationKey: r.key,
        trigger: event.trigger,
        contactId: event.contactId,
        payload: { ...event.payload, __depth: depth },
      }))
    )
    .returning({ id: automationRuns.id });

  const ids = rows.map((r) => r.id);
  scheduleProcessing(ids);
  return ids;
}

/** `after()` solo existe dentro de una request de Next; fuera, se procesa en el acto. */
function scheduleProcessing(ids: string[]): void {
  try {
    after(async () => {
      await processRuns(ids);
    });
  } catch {
    void processRuns(ids).catch((err) =>
      console.error("[automations] error procesando runs", err)
    );
  }
}

interface ActionResult {
  type: string;
  status: "done" | "skipped" | "failed";
  detail: string;
}

/** Procesa runs concretos. Cada uno se reclama atomicamente (pending -> processing). */
export async function processRuns(ids: string[]): Promise<void> {
  for (const id of ids) {
    const [claimed] = await db
      .update(automationRuns)
      .set({ status: "processing", attempts: sql`${automationRuns.attempts} + 1` })
      .where(and(eq(automationRuns.id, id), eq(automationRuns.status, "pending")))
      .returning();
    if (!claimed) continue;

    const [rule] = await db
      .select()
      .from(automations)
      .where(eq(automations.key, claimed.automationKey))
      .limit(1);
    if (!rule) {
      await finish(id, "failed", null, "La regla ya no existe");
      continue;
    }
    if (!claimed.contactId) {
      await finish(id, "skipped", null, "Evento sin contacto");
      continue;
    }

    const rawPayload = (claimed.payload as Record<string, unknown>) ?? {};
    const { __depth, ...payload } = rawPayload;
    const event: AutomationEvent = {
      trigger: claimed.trigger as TriggerKey,
      contactId: claimed.contactId,
      payload,
      depth: typeof __depth === "number" ? __depth : 0,
    };
    const ctx = {
      event,
      contactId: claimed.contactId,
      render: buildRenderer(event, claimed.contactId),
    };

    const actions = (rule.actions as ActionSpec[]) ?? [];
    const results: ActionResult[] = [];
    let failed: string | null = null;

    for (const [i, spec] of actions.entries()) {
      const def = actionFor(spec.type);
      if (!def) {
        results.push({ type: spec.type, status: "failed", detail: "Accion desconocida" });
        failed = `Accion ${i + 1} desconocida`;
        break;
      }
      try {
        const out = await def.run(ctx, spec.params ?? {});
        results.push({ type: spec.type, ...out });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error desconocido";
        results.push({ type: spec.type, status: "failed", detail: msg });
        failed = `${def.label}: ${msg}`;
        break;
      }
    }

    if (failed) {
      if (claimed.attempts + 1 >= MAX_ATTEMPTS) {
        await finish(id, "failed", results, failed);
      } else {
        // Vuelve a pending con backoff: el sweeper lo reintenta desde cero.
        await db
          .update(automationRuns)
          .set({
            status: "pending",
            error: failed,
            result: results,
            processAfter: new Date(Date.now() + 30_000 * (claimed.attempts + 1)),
          })
          .where(eq(automationRuns.id, id));
      }
      continue;
    }

    const anyDone = results.some((r) => r.status === "done");
    await finish(
      id,
      anyDone ? "done" : "skipped",
      results,
      anyDone ? null : results.map((r) => r.detail).join(" · ") || "Sin acciones"
    );
  }
}

async function finish(
  id: string,
  status: "done" | "skipped" | "failed",
  result: ActionResult[] | null,
  error: string | null
): Promise<void> {
  await db
    .update(automationRuns)
    .set({ status, result, error, processedAt: new Date() })
    .where(eq(automationRuns.id, id));
}

/** Sweeper: runs pendientes que nadie retomo. */
export async function processStaleRuns(limit = 20): Promise<number> {
  const stale = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.status, "pending"),
        lt(automationRuns.processAfter, new Date(Date.now() - STALE_AFTER_MS))
      )
    )
    .orderBy(automationRuns.createdAt)
    .limit(limit);
  if (stale.length > 0) await processRuns(stale.map((r) => r.id));
  return stale.length;
}

// ---------------------------------------------------------------------------
// Catalogo para la UI
// ---------------------------------------------------------------------------

export async function getCatalog() {
  const triggers = await Promise.all(
    TRIGGERS.map(async (t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      placeholders: t.placeholders,
      filterFields: await Promise.all(
        t.filterFields.map(async (f) => ({
          key: f.key,
          label: f.label,
          options: await f.options(),
        }))
      ),
    }))
  );
  const actions = await Promise.all(
    ACTIONS.map(async (a) => ({
      key: a.key,
      label: a.label,
      description: a.description,
      params: await Promise.all(
        a.params.map(async (p) => ({
          key: p.key,
          label: p.label,
          type: p.type,
          required: p.required ?? false,
          placeholder: p.placeholder ?? null,
          templated: p.templated ?? false,
          options: p.options ? await p.options() : null,
        }))
      ),
    }))
  );
  return { triggers, actions };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export interface AutomationInput {
  name: string;
  trigger: string;
  filters: unknown;
  actions: unknown;
  enabled: boolean;
  description?: string | null;
}

export interface AutomationRecord {
  key: string;
  name: string;
  description: string | null;
  trigger: TriggerKey;
  enabled: boolean;
  filters: AutomationFilter[];
  actions: ActionSpec[];
  source: "seed" | "user";
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: typeof automations.$inferSelect): AutomationRecord {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    trigger: row.trigger as TriggerKey,
    enabled: row.enabled,
    filters: (row.filters as AutomationFilter[]) ?? [],
    actions: (row.actions as ActionSpec[]) ?? [],
    source: row.source === "seed" ? "seed" : "user",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface AutomationData {
  name: string;
  trigger: TriggerKey;
  filters: AutomationFilter[];
  actions: ActionSpec[];
  enabled: boolean;
  description: string | null;
}

/** Valida contra el catalogo. Devuelve los datos limpios o la lista de errores. */
export function validateAutomation(
  input: AutomationInput
): { ok: true; data: AutomationData } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = (input.name ?? "").trim();
  if (!name) errors.push("Falta el nombre");

  const trigger = triggerFor(input.trigger);
  if (!trigger) errors.push("Disparador invalido");

  const filters = trigger ? sanitizeFilters(trigger, input.filters) : [];
  const { actions, errors: actionErrors } = sanitizeActions(input.actions);
  errors.push(...actionErrors);
  if (actions.length === 0) errors.push("Agrega al menos una accion");

  if (errors.length > 0 || !trigger) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      trigger: trigger.key,
      filters,
      actions,
      enabled: Boolean(input.enabled),
      description: input.description?.trim() || null,
    },
  };
}

export async function createAutomation(data: AutomationData): Promise<AutomationRecord> {
  const [row] = await db
    .insert(automations)
    .values({ key: crypto.randomUUID(), ...data, source: "user" })
    .returning();
  return toRecord(row);
}

export async function updateAutomation(
  key: string,
  data: AutomationData
): Promise<AutomationRecord | null> {
  const [row] = await db
    .update(automations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(automations.key, key))
    .returning();
  return row ? toRecord(row) : null;
}

export async function getAutomation(key: string): Promise<AutomationRecord | null> {
  const [row] = await db.select().from(automations).where(eq(automations.key, key)).limit(1);
  return row ? toRecord(row) : null;
}

/** Las sembradas no se borran (se apagan): son el ejemplo de como se arma una regla. */
export async function deleteAutomation(key: string): Promise<"deleted" | "not_found" | "seed"> {
  const existing = await getAutomation(key);
  if (!existing) return "not_found";
  if (existing.source === "seed") return "seed";
  await db.delete(automations).where(eq(automations.key, key));
  return "deleted";
}

export async function setAutomationEnabled(key: string, enabled: boolean): Promise<boolean> {
  const rows = await db
    .update(automations)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(automations.key, key))
    .returning({ key: automations.key });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Lectura para la lista
// ---------------------------------------------------------------------------

export interface AutomationListItem extends AutomationRecord {
  triggerLabel: string;
  /** "Cuando: Etapa cambia a Lead asignado (Ventas) → Push a asesor · Etiqueta urgente" */
  summary: { when: string; then: string };
  stats: { done: number; skipped: number; failed: number; pending: number };
}

async function describeFilters(trigger: TriggerKey, filters: AutomationFilter[]): Promise<string> {
  const def = triggerFor(trigger);
  const base = def?.label ?? trigger;
  if (filters.length === 0) return base;

  const parts: string[] = [];
  for (const f of filters) {
    const values = Array.isArray(f.value) ? f.value : [f.value];
    const labels = await Promise.all(values.map((v) => labelFor(f.field, v)));
    const field = def?.filterFields.find((x) => x.key === f.field)?.label ?? f.field;
    const op = f.op === "neq" ? "no es" : "es";
    parts.push(`${field} ${op} ${labels.join(" o ")}`);
  }
  return `${base} · ${parts.join(" · ")}`;
}

async function labelFor(field: string, value: string): Promise<string> {
  if (field === "stageId" || field === "previousStageId") return stageLabel(value);
  if (field === "pipelineId") {
    const [p] = await db.execute<{ name: string }>(
      sql`select name from pipelines where id = ${value} limit 1`
    );
    return p?.name ?? value;
  }
  if (field === "ownerId") {
    const m = await getMember(value);
    return m ? displayName(m) : value;
  }
  if (field === "source") return SOURCE_LABELS[value as LeadSource] ?? value;
  if (field === "channel") return isChannel(value) ? CHANNEL_LABELS[value] : value;
  return value;
}

export async function listAutomations(): Promise<AutomationListItem[]> {
  const rows = await db.select().from(automations).orderBy(desc(automations.createdAt));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = await db
    .select({
      key: automationRuns.automationKey,
      status: automationRuns.status,
      total: sql<number>`count(*)::int`,
    })
    .from(automationRuns)
    .where(gte(automationRuns.createdAt, since))
    .groupBy(automationRuns.automationKey, automationRuns.status);

  return Promise.all(
    rows.map(async (row) => {
      const rec = toRecord(row);
      const stats = { done: 0, skipped: 0, failed: 0, pending: 0 };
      for (const c of counts) {
        if (c.key !== rec.key) continue;
        if (c.status === "done") stats.done = c.total;
        else if (c.status === "skipped") stats.skipped = c.total;
        else if (c.status === "failed") stats.failed = c.total;
        else stats.pending += c.total;
      }
      return {
        ...rec,
        triggerLabel: triggerFor(rec.trigger)?.label ?? rec.trigger,
        summary: {
          when: await describeFilters(rec.trigger, rec.filters),
          then: await describeActions(rec.actions),
        },
        stats,
      };
    })
  );
}

export interface AutomationRunItem {
  id: string;
  automationKey: string;
  automationName: string;
  trigger: TriggerKey;
  contactId: string | null;
  contactName: string | null;
  status: string;
  attempts: number;
  result: ActionResult[] | null;
  error: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export async function listRuns(opts?: { limit?: number; key?: string }): Promise<AutomationRunItem[]> {
  const base = db
    .select({
      id: automationRuns.id,
      automationKey: automationRuns.automationKey,
      automationName: automations.name,
      trigger: automationRuns.trigger,
      contactId: automationRuns.contactId,
      contactName: contacts.name,
      status: automationRuns.status,
      attempts: automationRuns.attempts,
      result: automationRuns.result,
      error: automationRuns.error,
      createdAt: automationRuns.createdAt,
      processedAt: automationRuns.processedAt,
    })
    .from(automationRuns)
    .leftJoin(automations, eq(automations.key, automationRuns.automationKey))
    .leftJoin(contacts, eq(contacts.id, automationRuns.contactId));

  const rows = await (opts?.key ? base.where(eq(automationRuns.automationKey, opts.key)) : base)
    .orderBy(desc(automationRuns.createdAt))
    .limit(opts?.limit ?? 50);

  return rows.map((r) => ({
    ...r,
    automationName: r.automationName ?? r.automationKey,
    trigger: r.trigger as TriggerKey,
    result: (r.result as ActionResult[] | null) ?? null,
  }));
}
