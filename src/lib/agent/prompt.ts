import { db } from "@/db";
import { contacts, crmSettings, deals, pipelineStages, pipelines } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { camposContacto, getConfig } from "@/lib/config";
import { resumirCampos } from "@/lib/config/campos";

export const SYSTEM_PROMPT_SETTINGS_KEY = "agent.system_prompt";

/**
 * Prompt base del nucleo: generico, sirve para cualquier negocio. Lo que es propio de
 * un cliente va en `config/cliente.ts` (`agente.prompt`, que lo reemplaza como base) o
 * en una plantilla de nicho. Cascada completa:
 *
 *   agent_configs[canal] -> crm_settings global -> config.agente.prompt -> este default
 *
 * Placeholders: {{agente}}, {{negocio}}, {{fecha}}, {{canal}}. Al final del prompt el
 * agente agrega las secciones CONTEXTO (cliente, pipeline, datos a averiguar) y EQUIPO.
 */
const DEFAULT_SYSTEM_PROMPT = `# ROL
Sos {{agente}}, parte del equipo de {{negocio}}. Atendes a las personas que escriben por {{canal}}: respondes sus consultas, averiguas lo que el equipo necesita saber de cada una y lo registras en el CRM.

# COMO TRABAJAS
- Respondes en el idioma del cliente, breve y natural (1 a 3 parrafos cortos).
- No decis que sos una IA ni hablas de herramientas internas.
- Cuando el cliente da un dato util (su nombre, que busca, presupuesto, plazos...), lo guardas con actualizar_contacto antes de responder. La seccion DATOS A AVERIGUAR dice que preguntar; preguntalo de a uno, en el momento natural, sin interrogar.
- Cuando el cliente avanza (muestra interes, pide una propuesta, quiere hablar con alguien) o se enfria, moves la operacion con mover_etapa a la etapa que corresponda segun PIPELINE.
- Si tenes que anotar algo para el equipo (llamar manana, enviar propuesta), usas registrar_actividad.
- Cuando la conversacion llega a un punto util (ya sabes que busca el cliente, o se despidio), dejas un resumen_lead de 2 a 4 frases con lo importante.
- Si no sabes algo, el cliente pide hablar con una persona, o una herramienta falla, usas derivar_asesor y respondes con calma que una persona del equipo sigue la conversacion.
- Nunca inventes precios, disponibilidad ni condiciones: si no estan en el contexto o en una herramienta, derivas.

# IMPORTANTE
- La fecha de hoy es {{fecha}}.
- Tus respuestas se envian directamente por {{canal}} al cliente.
- Despues de usar una herramienta, integras la informacion en tu respuesta natural; nunca copias el JSON.`;

/**
 * Guia de estilo segun por donde entra el mensaje. Un DM de Instagram no se escribe
 * como un WhatsApp. Es el piso comun; el prompt propio de cada canal lo puede pisar.
 */
const CHANNEL_HINTS: Record<string, string> = {
  whatsapp: "Manten cada respuesta corta y natural (1-3 parrafos cortos). Podes incluir links si aportan.",
  instagram:
    "Estas en un DM de Instagram: responde en 1 o 2 frases, tono informal y directo. Evita pegar URLs largas; si hace falta detalle, ofrece seguir por WhatsApp y pedi el numero.",
  facebook: "Estas en Messenger: respuestas breves (1 o 2 frases) y tono cercano. Podes incluir un link si aporta.",
};

const CHANNEL_NAMES: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
  simulador: "el simulador",
};

/** Prompt base de la instancia: el de config/cliente.ts si existe, si no el del nucleo. */
export function getDefaultSystemPromptTemplate(): string {
  return getConfig().agente.prompt?.trim() || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Template global (override en `crm_settings`, editable desde Ajustes) SIN reemplazar
 * placeholders. Cae al default de la instancia.
 */
export async function getSystemPromptTemplate(): Promise<string> {
  try {
    const [row] = await db.select().from(crmSettings).where(eq(crmSettings.key, SYSTEM_PROMPT_SETTINGS_KEY)).limit(1);
    const stored = row?.value?.trim();
    if (stored) return stored;
  } catch (err) {
    console.error("[prompt] error leyendo override, usando default", err);
  }
  return getDefaultSystemPromptTemplate();
}

export const getGlobalSystemPromptTemplate = getSystemPromptTemplate;

/** Reemplaza placeholders y agrega la guia del canal. */
export function renderSystemPrompt(template: string, opts: { now?: Date; channel?: string } = {}): string {
  const now = opts.now ?? new Date();
  const channel = opts.channel ?? "whatsapp";
  const { marca, agente, idioma, zonaHoraria } = getConfig();

  // La zona es la del negocio, no la del proceso: el contenedor corre en UTC, y sin esto
  // el agente le dice "manana" al cliente que escribe de noche.
  const fecha = now.toLocaleDateString(idioma === "en" ? "en-US" : "es", {
    timeZone: zonaHoraria,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rendered = template
    .replaceAll("{{fecha}}", fecha)
    .replaceAll("{{canal}}", CHANNEL_NAMES[channel] ?? channel)
    .replaceAll("{{agente}}", agente.nombre)
    .replaceAll("{{negocio}}", marca.nombre);

  const hint = CHANNEL_HINTS[channel];
  return hint ? `${rendered}\n\n# CANAL\n${hint}` : rendered;
}

/**
 * Seccion CONTEXTO: lo que el agente sabe del cliente, en que etapa esta, que etapas
 * existen y que datos tiene que averiguar. Es lo que hace utiles a mover_etapa y
 * actualizar_contacto sin cablear nada del negocio en el codigo.
 */
export async function renderContexto(contactId: string): Promise<string> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) return "";

  const campos = camposContacto();
  const conocidos = resumirCampos(campos, contact.customFields as Record<string, never> | null);
  const aAveriguar = campos
    .filter((c) => c.agente?.calificar !== false && c.agente)
    .filter((c) => {
      const v = (contact.customFields as Record<string, unknown> | null)?.[c.clave];
      return v === null || v === undefined || v === "";
    })
    .map((c) => `- ${c.etiqueta} (${c.clave}${c.opciones ? ": " + c.opciones.join(" | ") : ""}): ${c.agente?.descripcion ?? "preguntar con naturalidad"}`);

  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
  let etapasTxt = "";
  let etapaActual = "sin operacion abierta";
  if (pipeline) {
    const stages = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipeline.id))
      .orderBy(pipelineStages.order);
    etapasTxt = stages.map((s) => `- ${s.key ?? s.name}: ${s.name}${s.isWon ? " (ganada)" : s.isLost ? " (perdida)" : ""}`).join("\n");
    const [abierta] = await db
      .select({ name: pipelineStages.name })
      .from(deals)
      .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(and(eq(deals.contactId, contactId), eq(pipelineStages.pipelineId, pipeline.id)))
      .orderBy(desc(deals.updatedAt))
      .limit(1);
    if (abierta) etapaActual = abierta.name;
  }

  const partes = [
    "\n\n# CONTEXTO",
    "## Cliente",
    `- Nombre: ${contact.name}${contact.email ? `\n- Email: ${contact.email}` : ""}${contact.phone ? `\n- Telefono: ${contact.phone}` : ""}`,
    ...(conocidos.length ? [`- Datos conocidos: ${conocidos.join("; ")}`] : []),
    ...(contact.aiSummary ? [`- Resumen previo: ${contact.aiSummary}`] : []),
    `- Etapa actual: ${etapaActual}`,
  ];
  if (etapasTxt) partes.push("## Pipeline (clave: nombre)", etapasTxt);
  if (aAveriguar.length) partes.push("## Datos a averiguar", ...aAveriguar);
  return partes.join("\n");
}

/** Prompt final con el template global (sin contexto de contacto). Para previews. */
export async function buildSystemPrompt(now: Date, channel = "whatsapp"): Promise<string> {
  const template = await getSystemPromptTemplate();
  return renderSystemPrompt(template, { now, channel });
}
