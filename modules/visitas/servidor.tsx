import "server-only";
import { NextResponse } from "next/server";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts } from "@/db/schema";
import { canAccessContactId, ownerFilter } from "@/lib/team";
import type { ModuloServidor, HandlerModulo } from "@/lib/modules/types";
import manifiesto from "./manifiesto";
import { visitas } from "./tabla";
import { ESTADOS_VISITA, type EstadoVisita } from "./tipos";
import { VisitasPage } from "./componentes/VisitasPage";
import { CalendarioPage } from "./componentes/CalendarioPage";

async function visitasVisibles(memberFilter: SQL | undefined, extra: SQL[] = []) {
  const conditions = [...extra];
  if (memberFilter) conditions.push(memberFilter);
  const base = db
    .select({
      id: visitas.id,
      contactId: visitas.contactId,
      dealId: visitas.dealId,
      propertyAddress: visitas.propertyAddress,
      status: visitas.status,
      scheduledAt: visitas.scheduledAt,
      durationMinutes: visitas.durationMinutes,
      notes: visitas.notes,
      createdAt: visitas.createdAt,
      updatedAt: visitas.updatedAt,
      contactName: contacts.name,
      contactPhone: contacts.phone,
    })
    .from(visitas)
    .leftJoin(contacts, eq(visitas.contactId, contacts.id));
  return conditions.length > 0
    ? base.where(and(...conditions)).orderBy(desc(visitas.createdAt))
    : base.orderBy(desc(visitas.createdAt));
}

const listar: HandlerModulo = async (req, { member }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const contactId = searchParams.get("contactId");
  const extra: SQL[] = [];
  if (status) extra.push(eq(visitas.status, status));
  if (contactId) extra.push(eq(visitas.contactId, contactId));
  return NextResponse.json(await visitasVisibles(ownerFilter(member), extra));
};

const crear: HandlerModulo = async (req, { member }) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  const contactId = typeof body.contactId === "string" ? body.contactId : "";
  if (!contactId) return NextResponse.json({ error: "El contacto es requerido" }, { status: 400 });
  if (!(await canAccessContactId(member, contactId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }
  const status = (typeof body.status === "string" ? body.status : "coordinating") as EstadoVisita;
  if (!ESTADOS_VISITA.includes(status)) {
    return NextResponse.json({ error: `Estado invalido. Usa: ${ESTADOS_VISITA.join(", ")}` }, { status: 400 });
  }
  if (status === "scheduled" && !body.scheduledAt) {
    return NextResponse.json({ error: "Una visita coordinada requiere fecha y hora" }, { status: 400 });
  }
  const [row] = await db
    .insert(visitas)
    .values({
      contactId,
      dealId: typeof body.dealId === "string" ? body.dealId : null,
      propertyAddress: typeof body.propertyAddress === "string" ? body.propertyAddress : null,
      status,
      scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
      durationMinutes: Number(body.durationMinutes) || 60,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
};

async function visitaAccesible(member: Parameters<HandlerModulo>[1]["member"], id: string) {
  const [v] = await db.select({ contactId: visitas.contactId }).from(visitas).where(eq(visitas.id, id)).limit(1);
  if (!v) return false;
  return canAccessContactId(member, v.contactId);
}

const actualizar: HandlerModulo = async (req, { member, params }) => {
  if (!(await visitaAccesible(member, params.id))) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  const updates: Partial<typeof visitas.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.status === "string" && ESTADOS_VISITA.includes(body.status as EstadoVisita)) updates.status = body.status;
  if (body.scheduledAt !== undefined) updates.scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
  if (body.propertyAddress !== undefined) updates.propertyAddress = body.propertyAddress ? String(body.propertyAddress) : null;
  if (body.durationMinutes !== undefined) updates.durationMinutes = Number(body.durationMinutes) || 60;
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  if (body.dealId !== undefined) updates.dealId = body.dealId ? String(body.dealId) : null;
  const [row] = await db.update(visitas).set(updates).where(eq(visitas.id, params.id)).returning();
  return NextResponse.json(row);
};

const borrar: HandlerModulo = async (_req, { member, params }) => {
  if (!(await visitaAccesible(member, params.id))) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
  await db.delete(visitas).where(eq(visitas.id, params.id));
  return NextResponse.json({ ok: true });
};

const modulo: ModuloServidor = {
  manifiesto,

  paginas: {
    "": () => <VisitasPage />,
    calendario: () => <CalendarioPage />,
  },

  api: {
    "": { GET: listar, POST: crear },
    "[id]": { PATCH: actualizar, DELETE: borrar },
  },

  tools: [
    {
      definicion: {
        type: "function",
        function: {
          name: "agendar_visita",
          description:
            "Inicia la coordinacion de una visita (queda en estado 'coordinando' para que una persona confirme fecha y hora). Usar solo cuando el cliente muestra interes genuino en visitar.",
          parameters: {
            type: "object",
            properties: {
              lugar: { type: "string", description: "Direccion o nombre de la propiedad o lugar a visitar." },
              notas: { type: "string", description: "Preferencia de horario u otros comentarios del cliente." },
            },
            required: ["lugar"],
            additionalProperties: false,
          },
        },
      },
      descripcionUI: "Permite al agente iniciar la coordinacion de una visita (modulo visitas).",
      async ejecutar(args, ctx) {
        const lugar = String(args.lugar ?? "").trim();
        if (!lugar) return { ok: false, error: "lugar vacio" };
        const [created] = await db
          .insert(visitas)
          .values({ contactId: ctx.contactId, propertyAddress: lugar, status: "coordinating", notes: args.notas ? String(args.notas) : null })
          .returning({ id: visitas.id });
        await db.insert(activities).values({
          type: "note",
          description: `Agente IA inicio la coordinacion de una visita: ${lugar}`,
          contactId: ctx.contactId,
        });
        return {
          ok: true,
          data: { visitaId: created.id, status: "coordinating", message: "Visita registrada en coordinacion; una persona confirma fecha y hora." },
        };
      },
    },
  ],

  async seed() {
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from visitas`)) as unknown as [{ n: number }];
    if (n > 0) return;
    const algunos = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).limit(4);
    if (algunos.length === 0) return;
    const ahora = Date.now();
    const dia = 86_400_000;
    await db.insert(visitas).values(
      algunos.map((c, i) => ({
        contactId: c.id,
        propertyAddress: ["Av. Principal 1234, depto 5B", "Calle Los Olivos 88", "Pasaje Las Flores 12", "Edificio Mirador, oficina 302"][i % 4],
        status: (["scheduled", "coordinating", "completed", "scheduled"] as const)[i % 4],
        scheduledAt: i % 4 === 1 ? null : new Date(ahora + (i - 1) * dia + 15 * 3_600_000),
        durationMinutes: 60,
        notes: i === 0 ? "Prefiere por la tarde." : null,
      }))
    );
  },
};

export default modulo;
