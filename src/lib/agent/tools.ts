import "server-only";
import type OpenAI from "openai";
import { db } from "@/db";
import {
  activities,
  contacts,
  conversations,
  crmSettings,
  deals,
  pipelineStages,
  pipelines,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { assignContact } from "@/lib/contacts/assign";
import { displayName, findMemberByName } from "@/lib/team";
import { setDealStage } from "@/lib/deals/stage";
import { camposContacto, getConfig } from "@/lib/config";
import { validarCamposPersonalizados } from "@/lib/config/campos";
import { toolsDeModulos } from "@/lib/modules";

/**
 * Tools del agente.
 *
 * Las del NUCLEO son genericas: sirven para cualquier negocio y actuan sobre el CRM
 * (etapa, ficha, actividades, resumen, derivacion, asignacion). Lo especifico de un
 * nicho (propiedades, visitas...) lo aportan los modulos activos (`servidor.tools`).
 *
 * Ajustes -> Agente lista todo esto y permite apagar cada una por canal.
 */

export const ENABLED_TOOLS_SETTINGS_KEY = "agent.enabled_tools";

export interface ToolContext {
  contactId: string;
  /** Solo WhatsApp. En Instagram y Messenger no hay telefono: el identificador es IGSID/PSID. */
  contactPhone: string | null;
  conversationId?: string | null;
  channel?: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /**
   * true = despues de este resultado el agente no sigue el loop: manda el mensaje de
   * derivacion y termina (derivar_asesor).
   */
  stop?: boolean;
}

export interface ToolAgente {
  definicion: OpenAI.Chat.Completions.ChatCompletionFunctionTool;
  /** Texto para Ajustes -> Agente IA. */
  descripcionUI: string;
  ejecutar: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

type Params = NonNullable<OpenAI.Chat.Completions.ChatCompletionFunctionTool["function"]["parameters"]>;

function definir(name: string, description: string, parameters: Params): OpenAI.Chat.Completions.ChatCompletionFunctionTool {
  return { type: "function", function: { name, description, parameters } };
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// ============================================================
// Tools genericas del nucleo
// ============================================================

async function moverEtapa(args: { etapa?: string; motivo?: string }, ctx: ToolContext): Promise<ToolResult> {
  const q = normalizar(String(args.etapa ?? ""));
  if (!q) return { ok: false, error: "etapa vacia" };

  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
  if (!pipeline) return { ok: false, error: "No hay pipeline configurado" };

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipeline.id))
    .orderBy(pipelineStages.order);

  const stage =
    stages.find((s) => s.key === q || normalizar(s.name) === q) ??
    stages.find((s) => normalizar(s.name).includes(q) || (s.key ?? "").includes(q));
  if (!stage) {
    return {
      ok: false,
      error: `Etapa desconocida "${args.etapa}". Disponibles: ${stages.map((s) => s.key ?? s.name).join(", ")}`,
    };
  }

  // Operacion abierta del contacto en este pipeline (la mas reciente).
  const [abierta] = await db
    .select({ id: deals.id, stageId: deals.stageId })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(
      and(
        eq(deals.contactId, ctx.contactId),
        eq(pipelineStages.pipelineId, pipeline.id),
        eq(pipelineStages.isWon, false),
        eq(pipelineStages.isLost, false)
      )
    )
    .orderBy(desc(deals.updatedAt))
    .limit(1);

  if (abierta) {
    if (abierta.stageId === stage.id) {
      return { ok: true, data: { etapa: stage.name, sin_cambio: true, message: `Ya estaba en ${stage.name}.` } };
    }
    const r = await setDealStage({ dealId: abierta.id, stageId: stage.id });
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo mover la etapa" };
    await db.insert(activities).values({
      type: "note",
      description: `Agente IA movio la operacion a "${stage.name}"${args.motivo ? `: ${args.motivo}` : ""}`,
      contactId: ctx.contactId,
    });
    return { ok: true, data: { etapa: stage.name, operacion: abierta.id, creada: false } };
  }

  const [contact] = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, ctx.contactId)).limit(1);
  const [nueva] = await db
    .insert(deals)
    .values({ title: contact?.name ?? "Operacion", stageId: stage.id, contactId: ctx.contactId })
    .returning({ id: deals.id });
  await setDealStage({ dealId: nueva.id, stageId: stage.id, justCreated: true });
  await db.insert(activities).values({
    type: "note",
    description: `Agente IA creo la operacion en "${stage.name}"${args.motivo ? `: ${args.motivo}` : ""}`,
    contactId: ctx.contactId,
  });
  return { ok: true, data: { etapa: stage.name, operacion: nueva.id, creada: true } };
}

async function actualizarContacto(
  args: { nombre?: string; email?: string; telefono?: string; notas?: string; campos?: Record<string, unknown> },
  ctx: ToolContext
): Promise<ToolResult> {
  const [actual] = await db.select().from(contacts).where(eq(contacts.id, ctx.contactId)).limit(1);
  if (!actual) return { ok: false, error: "contacto no encontrado" };

  const set: Partial<typeof contacts.$inferInsert> = { updatedAt: new Date() };
  const cambios: string[] = [];

  if (typeof args.nombre === "string" && args.nombre.trim()) {
    set.name = args.nombre.trim().slice(0, 120);
    cambios.push("nombre");
  }
  if (typeof args.email === "string" && args.email.includes("@")) {
    set.email = args.email.trim().toLowerCase();
    cambios.push("email");
  }
  if (typeof args.telefono === "string" && args.telefono.trim()) {
    set.phone = args.telefono.trim();
    cambios.push("telefono");
  }
  if (typeof args.notas === "string" && args.notas.trim()) {
    const nota = `[IA] ${args.notas.trim()}`;
    set.notes = actual.notes ? `${actual.notes}\n${nota}` : nota;
    cambios.push("notas");
  }
  if (args.campos && typeof args.campos === "object") {
    const v = validarCamposPersonalizados(camposContacto(), args.campos, { parcial: true });
    if (!v.ok) return { ok: false, error: v.error };
    set.customFields = { ...((actual.customFields as Record<string, unknown> | null) ?? {}), ...v.valores };
    cambios.push(...Object.keys(v.valores));
  }

  if (cambios.length === 0) return { ok: false, error: "nada para actualizar" };
  await db.update(contacts).set(set).where(eq(contacts.id, ctx.contactId));
  return { ok: true, data: { actualizado: cambios } };
}

const TIPOS_ACTIVIDAD: Record<string, string> = {
  nota: "note",
  tarea: "follow_up",
  seguimiento: "follow_up",
  llamada: "call",
  reunion: "meeting",
  email: "email",
};

async function registrarActividad(
  args: { tipo?: string; descripcion?: string; fecha?: string },
  ctx: ToolContext
): Promise<ToolResult> {
  const descripcion = String(args.descripcion ?? "").trim();
  if (!descripcion) return { ok: false, error: "descripcion vacia" };
  const tipo = TIPOS_ACTIVIDAD[normalizar(String(args.tipo ?? "nota"))] ?? "note";
  let scheduledAt: Date | null = null;
  if (args.fecha) {
    const d = new Date(String(args.fecha));
    if (!Number.isNaN(d.getTime())) scheduledAt = d;
  }
  const [row] = await db
    .insert(activities)
    .values({ type: tipo, description: `[IA] ${descripcion}`, contactId: ctx.contactId, scheduledAt })
    .returning({ id: activities.id });
  return { ok: true, data: { actividad: row.id, tipo, programada: scheduledAt?.toISOString() ?? null } };
}

async function resumenLead(
  args: { resumen?: string; campos?: Record<string, unknown> },
  ctx: ToolContext
): Promise<ToolResult> {
  const resumen = String(args.resumen ?? "").trim();
  if (!resumen) return { ok: false, error: "resumen vacio" };

  const set: Partial<typeof contacts.$inferInsert> = {
    aiSummary: resumen.slice(0, 2000),
    aiSummaryAt: new Date(),
    updatedAt: new Date(),
  };
  if (args.campos && typeof args.campos === "object") {
    const v = validarCamposPersonalizados(camposContacto(), args.campos, { parcial: true });
    if (!v.ok) return { ok: false, error: v.error };
    const [actual] = await db.select({ cf: contacts.customFields }).from(contacts).where(eq(contacts.id, ctx.contactId)).limit(1);
    set.customFields = { ...((actual?.cf as Record<string, unknown> | null) ?? {}), ...v.valores };
  }
  await db.update(contacts).set(set).where(eq(contacts.id, ctx.contactId));
  await db.insert(activities).values({
    type: "note",
    description: `Resumen del agente IA: ${resumen.slice(0, 500)}`,
    contactId: ctx.contactId,
  });
  return { ok: true, data: { guardado: true } };
}

async function derivarAsesor(args: { motivo?: string }, ctx: ToolContext): Promise<ToolResult> {
  const motivo = String(args.motivo ?? "derivado por el agente").slice(0, 300);
  const now = new Date();

  // Se apaga el agente en ESTA conversacion, no en el contacto entero: derivar una
  // consulta que entro por Instagram no deberia callar al agente en WhatsApp. El
  // kill-switch global del contacto sigue existiendo desde la ficha.
  if (ctx.conversationId) {
    await db
      .update(conversations)
      .set({ aiEnabled: false, needsHuman: true, needsHumanReason: motivo, needsHumanAt: now, updatedAt: now })
      .where(eq(conversations.id, ctx.conversationId));
  } else {
    await db
      .update(contacts)
      .set({ aiEnabled: false, needsHuman: true, needsHumanReason: motivo, needsHumanAt: now, updatedAt: now })
      .where(eq(contacts.id, ctx.contactId));
  }

  await db.insert(activities).values({
    type: "note",
    description: `Agente IA derivo a humano. Motivo: ${motivo}`,
    contactId: ctx.contactId,
  });

  return {
    ok: true,
    stop: true,
    data: { derivado: true, motivo, message: "Agente pausado en esta conversacion. Una persona del equipo sigue." },
  };
}

async function asignarAsesor(args: { asesor?: string; motivo?: string }, ctx: ToolContext): Promise<ToolResult> {
  const found = await findMemberByName(String(args.asesor ?? ""));

  if (found.status === "ambiguous") {
    return {
      ok: false,
      error:
        `Hay varias personas que coinciden con "${args.asesor}": ` +
        found.candidates.map(displayName).join(", ") +
        ". Especifica cual.",
    };
  }
  if (found.status === "not_found") {
    return {
      ok: false,
      error: `No existe "${args.asesor}". Disponibles: ` + (found.available.map(displayName).join(", ") || "ninguno"),
    };
  }

  const result = await assignContact({
    contactId: ctx.contactId,
    ownerId: found.member.id,
    by: { type: "agent" },
    reason: args.motivo,
  });
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    data: {
      asignado_a: displayName(found.member),
      ya_estaba_asignado: result.unchanged ?? false,
      message: result.unchanged
        ? `El contacto ya estaba asignado a ${displayName(found.member)}.`
        : `Contacto asignado a ${displayName(found.member)}. Se le envio un aviso.`,
    },
  };
}

function toolsGenericas(): ToolAgente[] {
  const campos = camposContacto();
  const etiquetaAsesor = getConfig().roles.etiquetaAsesor.toLowerCase();
  const descripcionCampos =
    campos.length > 0
      ? "Claves disponibles: " +
        campos
          .map((c) => `${c.clave} (${c.tipo}${c.opciones ? ": " + c.opciones.join("|") : ""})`)
          .join("; ")
      : "No hay campos personalizados configurados.";

  return [
    {
      definicion: definir(
        "mover_etapa",
        "Mueve la operacion del contacto a una etapa del pipeline (o la crea en esa etapa si no tiene una abierta). " +
          "Usar cuando el cliente avanza o retrocede en el proceso; las etapas disponibles estan en la seccion PIPELINE del contexto.",
        {
          type: "object",
          properties: {
            etapa: { type: "string", description: "Clave o nombre de la etapa, como figura en PIPELINE." },
            motivo: { type: "string", description: "Por que se mueve, en pocas palabras." },
          },
          required: ["etapa"],
          additionalProperties: false,
        }
      ),
      descripcionUI: "Mueve (o crea) la operacion del contacto en el pipeline. Que etapa usar en cada momento lo decide el prompt.",
      ejecutar: (a, ctx) => moverEtapa(a as { etapa?: string; motivo?: string }, ctx),
    },
    {
      definicion: definir(
        "actualizar_contacto",
        "Guarda en la ficha del contacto los datos que vas averiguando: nombre, email, telefono, notas y los campos personalizados del negocio. " +
          descripcionCampos,
        {
          type: "object",
          properties: {
            nombre: { type: "string" },
            email: { type: "string" },
            telefono: { type: "string" },
            notas: { type: "string", description: "Observacion breve para el equipo." },
            campos: {
              type: "object",
              description: "Pares clave: valor de los campos personalizados. " + descripcionCampos,
              additionalProperties: true,
            },
          },
          additionalProperties: false,
        }
      ),
      descripcionUI: "Actualiza la ficha del contacto (datos basicos y campos personalizados de config/cliente.ts).",
      ejecutar: (a, ctx) => actualizarContacto(a as Parameters<typeof actualizarContacto>[0], ctx),
    },
    {
      definicion: definir(
        "registrar_actividad",
        "Anota una actividad en la ficha para el equipo: una nota, o una tarea/seguimiento con fecha (por ejemplo 'llamar el lunes').",
        {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["nota", "tarea", "llamada", "reunion", "email"] },
            descripcion: { type: "string" },
            fecha: { type: "string", description: "ISO 8601 si es una tarea con fecha (opcional)." },
          },
          required: ["descripcion"],
          additionalProperties: false,
        }
      ),
      descripcionUI: "Registra notas y tareas con fecha en la ficha del contacto.",
      ejecutar: (a, ctx) => registrarActividad(a as Parameters<typeof registrarActividad>[0], ctx),
    },
    {
      definicion: definir(
        "resumen_lead",
        "Deja en la ficha un resumen de 2 a 4 frases de lo que busca el cliente, su situacion y los proximos pasos. " +
          "Usar cuando la conversacion llego a un punto util o el cliente se despidio. Puede incluir campos personalizados.",
        {
          type: "object",
          properties: {
            resumen: { type: "string" },
            campos: { type: "object", description: "Campos personalizados confirmados. " + descripcionCampos, additionalProperties: true },
          },
          required: ["resumen"],
          additionalProperties: false,
        }
      ),
      descripcionUI: "Escribe el resumen del lead en la ficha (visible en contactos y en el chat).",
      ejecutar: (a, ctx) => resumenLead(a as Parameters<typeof resumenLead>[0], ctx),
    },
    {
      definicion: definir(
        "derivar_asesor",
        "Pasa la conversacion a una persona del equipo y PAUSA al agente en este hilo. " +
          "Usar cuando la consulta excede lo que sabes, una herramienta falla, o el cliente pide hablar con alguien.",
        {
          type: "object",
          properties: { motivo: { type: "string", description: "Razon corta de la derivacion." } },
          required: ["motivo"],
          additionalProperties: false,
        }
      ),
      descripcionUI: "Permite al agente derivar a un humano (pausa el agente solo en esa conversacion). Recomendado dejar activa.",
      ejecutar: (a, ctx) => derivarAsesor(a as { motivo?: string }, ctx),
    },
    {
      definicion: definir(
        "asignar_asesor",
        `Asigna este contacto a un ${etiquetaAsesor} del equipo, que recibe un aviso. NO pausa al agente. ` +
          "Las personas disponibles estan en la seccion EQUIPO del contexto; usa el nombre tal cual aparece.",
        {
          type: "object",
          properties: {
            asesor: { type: "string", description: "Nombre (o email) como figura en EQUIPO." },
            motivo: { type: "string" },
          },
          required: ["asesor"],
          additionalProperties: false,
        }
      ),
      descripcionUI: `Permite al agente asignar el contacto a un ${etiquetaAsesor} por nombre. Dispara la automatizacion de aviso.`,
      ejecutar: (a, ctx) => asignarAsesor(a as { asesor?: string; motivo?: string }, ctx),
    },
  ];
}

// ============================================================
// Registro
// ============================================================

/** Todas las tools disponibles en esta instancia: nucleo + nicho + modulos activos. */
export function listarTools(): ToolAgente[] {
  return [...toolsGenericas(), ...toolsDeModulos()];
}

export function nombresDeTools(): string[] {
  return listarTools().map((t) => t.definicion.function.name);
}

export function descripcionesUI(): Array<{ name: string; description: string }> {
  return listarTools().map((t) => ({ name: t.definicion.function.name, description: t.descripcionUI }));
}

export function esNombreDeTool(name: string): boolean {
  return nombresDeTools().includes(name);
}

export async function executeTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = listarTools().find((t) => t.definicion.function.name === name);
  if (!tool) return { ok: false, error: `Tool desconocida: ${name}` };
  const argumentos = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  try {
    return await tool.ejecutar(argumentos, ctx);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error ejecutando tool" };
  }
}

/**
 * Tools habilitadas globalmente (`crm_settings`). Sin fila = todas. Los nombres que ya
 * no existen (modulo apagado, tool renombrada) se descartan.
 */
export async function getEnabledToolNames(): Promise<string[]> {
  const todas = nombresDeTools();
  try {
    const [row] = await db.select().from(crmSettings).where(eq(crmSettings.key, ENABLED_TOOLS_SETTINGS_KEY)).limit(1);
    if (!row) return todas;
    const parsed: unknown = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return todas;
    const set = new Set(todas);
    return parsed.filter((n): n is string => typeof n === "string" && set.has(n));
  } catch (err) {
    console.error("[tools] error leyendo enabled_tools, usando default", err);
    return todas;
  }
}

/** Definiciones para el LLM, filtradas a las habilitadas. */
export async function getEnabledToolDefinitions(names?: string[]): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  const enabled = new Set(names ?? (await getEnabledToolNames()));
  return listarTools()
    .filter((t) => enabled.has(t.definicion.function.name))
    .map((t) => t.definicion);
}
