import "server-only";
import { db } from "@/db";
import {
  activities,
  contacts,
  conversations,
  deals,
  messages,
  pipelineStages,
  pipelines,
  teamMembers,
} from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { camposContacto } from "@/lib/config";
import { setDealStage } from "@/lib/deals/stage";
import { ingestMessage, linkExtraIdentity, upsertConversation } from "@/lib/channels/ingest";
import { resolveDefaultTenantId } from "@/lib/tenants";
import { modulosActivos } from "@/lib/modules";
import type { CampoConfig } from "@/lib/config/schema";
import type { ValoresCampos } from "@/lib/config/campos";

/**
 * Datos de demostracion. Cero datos reales: nombres, telefonos y empresas inventados.
 *
 * Idempotente: los contactos llevan la etiqueta `demo`; si ya hay alguno, el nucleo no
 * vuelve a sembrar. Despues corre el `seed()` de cada modulo activo (cada uno decide
 * si ya tiene datos).
 *
 * Las conversaciones usan el conector `simulador`: en una demo se les puede responder
 * desde la bandeja y el agente contesta, sin que nada salga a un canal real. No se
 * excluyen de Reportes (solo se excluyen los contactos creados desde /simulador).
 *
 * Los campos personalizados se completan segun config/cliente.ts: la misma demo sirve
 * para cualquier plantilla.
 */

const PERSONAS = [
  { name: "Valentina Rojas", email: "valentina.rojas@ejemplo.com", phone: "+56 9 7000 0001", company: null, source: "whatsapp" },
  { name: "Matias Fuentes", email: "matias.fuentes@ejemplo.com", phone: "+56 9 7000 0002", company: "Fuentes y Cia", source: "instagram" },
  { name: "Camila Herrera", email: "camila.herrera@ejemplo.com", phone: "+56 9 7000 0003", company: null, source: "website" },
  { name: "Joaquin Paredes", email: "joaquin.paredes@ejemplo.com", phone: "+56 9 7000 0004", company: "Paredes Hnos", source: "referido" },
  { name: "Antonia Vidal", email: "antonia.vidal@ejemplo.com", phone: "+56 9 7000 0005", company: null, source: "facebook" },
  { name: "Benjamin Soto", email: "benjamin.soto@ejemplo.com", phone: "+56 9 7000 0006", company: "Soto Inversiones", source: "whatsapp" },
  { name: "Isidora Munoz", email: "isidora.munoz@ejemplo.com", phone: "+56 9 7000 0007", company: null, source: "formulario" },
  { name: "Tomas Carvajal", email: "tomas.carvajal@ejemplo.com", phone: "+56 9 7000 0008", company: null, source: "whatsapp" },
  { name: "Florencia Araya", email: "florencia.araya@ejemplo.com", phone: "+56 9 7000 0009", company: "Araya Consultores", source: "instagram" },
  { name: "Lucas Pizarro", email: "lucas.pizarro@ejemplo.com", phone: "+56 9 7000 0010", company: null, source: "evento" },
  { name: "Martina Salazar", email: "martina.salazar@ejemplo.com", phone: "+56 9 7000 0011", company: null, source: "website" },
  { name: "Diego Contreras", email: "diego.contreras@ejemplo.com", phone: "+56 9 7000 0012", company: "Contreras SpA", source: "whatsapp" },
];

const ZONAS = ["Providencia", "Las Condes", "Nunoa", "La Reina", "Vitacura", "Santiago Centro", "Maipu", "Colina"];

/** Valor plausible para cada campo segun su tipo (misma demo para cualquier plantilla). */
function valorDemo(campo: CampoConfig, i: number): ValoresCampos[string] {
  switch (campo.tipo) {
    case "seleccion":
      return campo.opciones?.[i % (campo.opciones.length || 1)] ?? null;
    case "numero": {
      const esMonto = /presupuesto|precio|monto|valor|importe/i.test(campo.clave + campo.etiqueta);
      return esMonto ? [85000, 120000, 150000, 180000, 240000, 320000][i % 6] : (i % 4) + 1;
    }
    case "booleano":
      return i % 2 === 0;
    case "fecha":
      return new Date(Date.now() + ((i % 10) + 1) * 86_400_000).toISOString().slice(0, 10);
    default:
      return ZONAS[i % ZONAS.length];
  }
}

const GUIONES: Array<Array<{ dir: "in" | "out"; origen?: "agent" | "human"; body: string }>> = [
  [
    { dir: "in", body: "Hola! Vi una publicacion de ustedes y quiero mas informacion." },
    { dir: "out", origen: "agent", body: "Hola! Con gusto. Para orientarte mejor, que estas buscando y en que zona?" },
    { dir: "in", body: "Algo de 2 dormitorios, por Providencia o Nunoa, hasta 150 mil." },
    { dir: "out", origen: "agent", body: "Perfecto, tengo un par de opciones que calzan. Te las paso y si te interesa alguna coordinamos una visita." },
    { dir: "in", body: "Dale, mandame." },
  ],
  [
    { dir: "in", body: "Buenas, cuanto sale el arriendo de la oficina que publicaron?" },
    { dir: "out", origen: "agent", body: "Hola! La oficina de Apoquindo esta en USD 900 mensuales, 45 m2 habilitados. Te sirve ese tamano?" },
    { dir: "in", body: "Si, me gustaria verla esta semana." },
    { dir: "out", origen: "human", body: "Hola, soy del equipo. Te propongo jueves 11:00 o viernes 16:00, cual te acomoda?" },
  ],
  [
    { dir: "in", body: "Hola, estoy buscando casa con patio para mi familia." },
    { dir: "out", origen: "agent", body: "Que bueno! Cuantos dormitorios necesitan y en que zona les gustaria vivir?" },
    { dir: "in", body: "Minimo 3, idealmente La Reina o Penalolen." },
  ],
  [
    { dir: "in", body: "Me interesa invertir en algo chico para arrendar, que tienen?" },
    { dir: "out", origen: "agent", body: "Tengo un 1 dormitorio en Nunoa, edificio nuevo, en USD 95.000. Te paso el detalle?" },
    { dir: "in", body: "Si por favor, y si acepta credito." },
    { dir: "out", origen: "agent", body: "Es apto credito. Te dejo el link y, si quieres, agendamos una visita." },
  ],
  [
    { dir: "in", body: "Hola, necesito hablar con una persona, tengo dudas de financiamiento." },
    { dir: "out", origen: "agent", body: "Te paso con una persona del equipo que te va a ayudar con esto. En un momento te escribe." },
    { dir: "out", origen: "human", body: "Hola, soy Ana del equipo. Cuentame que dudas tienes y lo vemos juntos." },
  ],
  [
    { dir: "in", body: "Quiero arrendar una casa en Vitacura, 3 dormitorios." },
    { dir: "out", origen: "agent", body: "Tengo una casa de un piso con jardin en Vitacura por USD 2.400. Te gustaria visitarla?" },
    { dir: "in", body: "Si, el sabado en la manana puedo." },
  ],
];

export interface ResultadoSeed {
  yaExistia: boolean;
  contactos: number;
  operaciones: number;
  conversaciones: number;
  mensajes: number;
  modulos: string[];
}

export async function cargarDatosDemo(): Promise<ResultadoSeed> {
  const resultado: ResultadoSeed = { yaExistia: false, contactos: 0, operaciones: 0, conversaciones: 0, mensajes: 0, modulos: [] };

  const [existente] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(sql`'demo' = any(${contacts.tags})`)
    .limit(1);

  if (existente) {
    resultado.yaExistia = true;
  } else {
    await sembrarNucleo(resultado);
  }

  for (const m of modulosActivos()) {
    if (!m.seed) continue;
    await m.seed();
    resultado.modulos.push(m.manifiesto.nombre);
  }

  return resultado;
}

async function sembrarNucleo(r: ResultadoSeed) {
  const tenantId = await resolveDefaultTenantId();
  const [admin] = await db.select({ id: teamMembers.id }).from(teamMembers).orderBy(asc(teamMembers.createdAt)).limit(1);
  const campos = camposContacto();
  const ahora = Date.now();
  const dia = 86_400_000;

  // Contactos repartidos en los ultimos 40 dias, con campos de la plantilla.
  const creados: Array<{ id: string; name: string; source: string }> = [];
  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i];
    const valores: ValoresCampos = {};
    for (const c of campos) valores[c.clave] = valorDemo(c, i);
    const createdAt = new Date(ahora - (i * 3 + 1) * dia);
    const [row] = await db
      .insert(contacts)
      .values({
        name: p.name,
        email: p.email,
        phone: p.phone,
        company: p.company,
        source: p.source,
        score: 40 + ((i * 17) % 55),
        tags: ["demo", ...(i % 3 === 0 ? ["prioridad"] : [])],
        customFields: valores,
        ownerId: admin?.id ?? null,
        assignedAt: admin ? createdAt : null,
        tenantId,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: contacts.id, name: contacts.name, source: contacts.source });
    creados.push(row);
  }
  r.contactos = creados.length;

  // Operaciones repartidas por etapa del pipeline por defecto.
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
  if (pipeline) {
    const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id)).orderBy(asc(pipelineStages.order));
    if (stages.length > 0) {
      const valores = [95000, 165000, 120000, 320000, 78000, 240000, 150000, 180000, 90000];
      for (let i = 0; i < Math.min(9, creados.length); i++) {
        const stage = stages[(i * 2) % stages.length];
        const [deal] = await db
          .insert(deals)
          .values({
            title: creados[i].name,
            value: valores[i % valores.length] * 100,
            stageId: stage.id,
            contactId: creados[i].id,
            probability: stage.isWon ? 100 : stage.isLost ? 0 : 20 + ((i * 13) % 60),
            createdAt: new Date(ahora - (i * 3) * dia),
            updatedAt: new Date(ahora - i * dia),
          })
          .returning({ id: deals.id });
        await setDealStage({ dealId: deal.id, stageId: stage.id, justCreated: true });
        r.operaciones++;
      }
    }
  }

  // Actividades.
  const notas = [
    "Llamada inicial: le interesa visitar el fin de semana.",
    "Envie propuesta por correo, espera respuesta del banco.",
    "Pidio comparativa de dos opciones en la misma zona.",
    "Reunion presencial coordinada para la proxima semana.",
  ];
  for (let i = 0; i < Math.min(8, creados.length); i++) {
    await db.insert(activities).values({
      type: (["call", "email", "note", "meeting"] as const)[i % 4],
      description: notas[i % notas.length],
      contactId: creados[i].id,
      scheduledAt: i % 4 === 3 ? new Date(ahora + (i + 2) * dia) : null,
      completedAt: i % 4 === 3 ? null : new Date(ahora - i * dia),
      createdAt: new Date(ahora - (i + 1) * dia),
    });
  }

  // Conversaciones por el simulador: se pueden responder y el agente contesta.
  const canales = ["whatsapp", "instagram", "whatsapp", "facebook", "whatsapp", "instagram"] as const;
  for (let i = 0; i < GUIONES.length && i < creados.length; i++) {
    const contacto = creados[i];
    const canal = canales[i];
    const externalId = `demo:${contacto.id}`;
    await linkExtraIdentity(contacto.id, canal, externalId, null);
    const conv = await upsertConversation({
      tenantId: tenantId ?? "",
      contactId: contacto.id,
      accountId: null,
      channel: canal,
      provider: "simulador",
      externalId,
      participantId: externalId,
      participantName: contacto.name,
      participantHandle: canal === "instagram" ? contacto.name.toLowerCase().replace(/\s+/g, ".") : null,
      participantPicture: null,
    });
    r.conversaciones++;

    const base = ahora - (i + 1) * dia;
    const guion = GUIONES[i];
    for (let k = 0; k < guion.length; k++) {
      const m = guion[k];
      const sentAt = new Date(base + k * 7 * 60_000);
      if (m.dir === "in") {
        await ingestMessage({ conversation: conv, direction: "in", externalId: `demo:${contacto.id}:${k}`, body: m.body, sentAt, enqueueAgent: false });
      } else {
        await db.insert(messages).values({
          contactId: contacto.id,
          conversationId: conv.id,
          channel: canal,
          provider: "simulador",
          direction: "out",
          origin: m.origen ?? "human",
          type: "text",
          body: m.body,
          externalId: `demo:${contacto.id}:${k}`,
          status: "sent",
          tenantId,
          sentAt,
          createdAt: sentAt,
        });
      }
      r.mensajes++;
    }
    const ultimo = guion[guion.length - 1];
    const ultimoAt = new Date(base + (guion.length - 1) * 7 * 60_000);
    await db
      .update(contacts)
      .set({ updatedAt: ultimoAt })
      .where(eq(contacts.id, contacto.id));
    // Con el constructor, no con db.execute(sql``): en SQL crudo el driver no
    // serializa objetos Date y la consulta falla antes de salir.
    const idxUltimoEntrante = guion
      .map((g, idx) => (g.dir === "in" ? idx : -1))
      .filter((x) => x >= 0)
      .pop()!;
    await db
      .update(conversations)
      .set({
        lastMessageAt: ultimoAt,
        lastMessageBody: ultimo.body,
        lastDirection: ultimo.dir,
        unreadCount: ultimo.dir === "in" ? 1 : 0,
        lastInboundAt: new Date(base + idxUltimoEntrante * 7 * 60_000),
      })
      .where(eq(conversations.id, conv.id));
  }

  // Un hilo derivado a humano, para que la bandeja muestre el estado.
  if (creados[4]) {
    await db.execute(sql`
      update conversations set ai_enabled = false, needs_human = true,
        needs_human_reason = 'pidio hablar con una persona (financiamiento)', needs_human_at = now()
      where contact_id = ${creados[4].id}`);
  }
}
