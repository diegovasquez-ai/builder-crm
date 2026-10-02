import "server-only";
import { db } from "@/db";
import { pipelineStages, pipelines } from "@/db/schema";
import { asc } from "drizzle-orm";
import { SOURCE_LABELS } from "@/lib/constants";
import { CHANNEL_LABELS } from "@/lib/channels/types";
import { displayName, listMembers } from "@/lib/team";

/**
 * Catalogo de disparadores: QUE puede iniciar una regla y con que datos.
 *
 * Cada disparador declara los campos por los que se puede filtrar y de donde salen
 * las opciones (pipelines, etapas, asesores, fuentes). La UI del constructor lee esto
 * por `GET /api/automations/catalog`; el motor lo usa para evaluar filtros.
 *
 * Para agregar uno: una entrada aca + un `emitAutomationEvent` en el lugar del codigo
 * donde pasa la cosa (ver `src/lib/deals/stage.ts` y `src/lib/contacts/events.ts`).
 */

export type TriggerKey = "contact.created" | "contact.assigned" | "deal.stage_changed";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  options: () => Promise<SelectOption[]>;
}

export interface TriggerDef {
  key: TriggerKey;
  label: string;
  description: string;
  filterFields: FilterField[];
  /** Placeholders que las acciones pueden usar en sus textos con este disparador. */
  placeholders: string[];
}

export type FilterOp = "eq" | "neq" | "in";

export interface AutomationFilter {
  field: string;
  op: FilterOp;
  value: string | string[];
}

/** Lo que viaja con cada evento. `payload` es especifico del disparador. */
export interface AutomationEvent {
  trigger: TriggerKey;
  contactId: string | null;
  payload: Record<string, unknown>;
  /**
   * Profundidad de encadenamiento. Una accion que a su vez emite (asignar asesor ->
   * contact.assigned) suma 1. Pasado el tope, el motor ignora el evento: es la guardia
   * contra reglas que se disparan entre si para siempre.
   */
  depth?: number;
}

export const MAX_EVENT_DEPTH = 3;

// ---------------------------------------------------------------------------
// Payloads por disparador
// ---------------------------------------------------------------------------

export interface ContactCreatedPayload {
  contactName: string;
  source: string;
  /** whatsapp | instagram | facebook cuando el contacto nacio de un mensaje. */
  channel?: string | null;
}

export interface ContactAssignedPayload {
  contactName: string;
  ownerId: string | null;
  previousOwnerId: string | null;
  assignedBy: { type: "member"; memberId: string; name: string } | { type: "agent" };
}

export interface DealStageChangedPayload {
  dealId: string;
  dealTitle: string;
  contactName: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  /** null cuando la operacion recien se crea: "lead colocado en el pipeline". */
  previousStageId: string | null;
  previousStageName: string | null;
}

// ---------------------------------------------------------------------------
// Opciones
// ---------------------------------------------------------------------------

async function memberOptions(): Promise<SelectOption[]> {
  const members = await listMembers({ onlyActive: true });
  return members.map((m) => ({ value: m.id, label: displayName(m) }));
}

async function pipelineOptions(): Promise<SelectOption[]> {
  const rows = await db.select().from(pipelines).orderBy(asc(pipelines.order));
  return rows.map((p) => ({ value: p.id, label: p.name }));
}

/** Etapas de todos los pipelines, etiquetadas "Pipeline › Etapa" para que no se confundan. */
async function stageOptions(): Promise<SelectOption[]> {
  const [ps, stages] = await Promise.all([
    db.select().from(pipelines).orderBy(asc(pipelines.order)),
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.order)),
  ]);
  const nameOf = new Map(ps.map((p) => [p.id, p.name]));
  const varios = ps.length > 1;
  return stages.map((s) => ({
    value: s.id,
    label: varios ? `${nameOf.get(s.pipelineId) ?? "?"} › ${s.name}` : s.name,
  }));
}

async function sourceOptions(): Promise<SelectOption[]> {
  return Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));
}

async function channelOptions(): Promise<SelectOption[]> {
  return Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }));
}

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export const TRIGGERS: TriggerDef[] = [
  {
    key: "deal.stage_changed",
    label: "Etapa del pipeline",
    description:
      "Se activa cuando una operacion entra al pipeline o cambia de etapa. Filtra por pipeline y etapa para reaccionar solo a un movimiento concreto.",
    filterFields: [
      { key: "pipelineId", label: "Pipeline", options: pipelineOptions },
      { key: "stageId", label: "Etapa (nueva)", options: stageOptions },
      { key: "previousStageId", label: "Etapa anterior", options: stageOptions },
    ],
    placeholders: ["contacto", "etapa", "etapa_anterior", "pipeline", "operacion", "asesor"],
  },
  {
    key: "contact.assigned",
    label: "Contacto asignado a un asesor",
    description:
      "Se activa cuando se asigna (o cambia) el asesor a cargo de un contacto, desde la ficha o por el agente de IA.",
    filterFields: [{ key: "ownerId", label: "Asesor asignado", options: memberOptions }],
    placeholders: ["contacto", "asesor", "quien"],
  },
  {
    key: "contact.created",
    label: "Lead nuevo",
    description:
      "Se activa cuando entra un contacto nuevo: por un mensaje, por el webhook, por importacion o creado a mano.",
    filterFields: [
      { key: "source", label: "Fuente", options: sourceOptions },
      { key: "channel", label: "Canal", options: channelOptions },
    ],
    placeholders: ["contacto", "fuente"],
  },
];

export function triggerFor(key: string): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.key === key);
}

/**
 * Evalua los filtros de una regla contra el payload del evento. Sin filtros = pasa.
 * Puro: sin DB, para poder testearlo suelto.
 */
export function evaluateFilters(
  filters: AutomationFilter[] | null | undefined,
  payload: Record<string, unknown>
): boolean {
  if (!filters || filters.length === 0) return true;

  return filters.every((f) => {
    const actual = payload[f.field];
    const actualStr = actual === null || actual === undefined ? "" : String(actual);
    const wanted = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];

    switch (f.op) {
      case "eq":
        return wanted.length > 0 && actualStr === wanted[0];
      case "neq":
        return wanted.length > 0 && actualStr !== wanted[0];
      case "in":
        return wanted.includes(actualStr);
      default:
        return false;
    }
  });
}

/** Normaliza lo que llega del cliente a filtros validos para ese disparador. */
export function sanitizeFilters(trigger: TriggerDef, raw: unknown): AutomationFilter[] {
  if (!Array.isArray(raw)) return [];
  const fields = new Set(trigger.filterFields.map((f) => f.key));
  const out: AutomationFilter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { field, op, value } = item as Record<string, unknown>;
    if (typeof field !== "string" || !fields.has(field)) continue;
    if (op !== "eq" && op !== "neq" && op !== "in") continue;
    if (Array.isArray(value)) {
      const vals = value.filter((v): v is string => typeof v === "string" && v !== "");
      if (vals.length === 0) continue;
      out.push({ field, op, value: op === "in" ? vals : vals[0] });
    } else if (typeof value === "string" && value !== "") {
      out.push({ field, op, value: op === "in" ? [value] : value });
    }
  }
  return out;
}
