import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { TeamMember } from "@/lib/team";

/**
 * Reportes: numeros reales sobre un rango de dias, con la visibilidad del miembro
 * (un asesor ve solo sus contactos; el admin todo). Los contactos creados desde el
 * simulador (source = 'simulador') no suman; los datos de demostracion si.
 *
 * Todo sale de SQL directo porque son agregaciones con joins; cada bloque documenta
 * que mide. Los valores de operaciones estan en centavos (como en toda la app).
 */

export const RANGOS = [7, 30, 90] as const;
export type RangoDias = (typeof RANGOS)[number];

export interface Kpi {
  actual: number;
  anterior: number;
}

export interface Reporte {
  dias: RangoDias;
  desde: string;
  kpis: {
    contactosNuevos: Kpi;
    conversacionesNuevas: Kpi;
    mensajesEntrantes: Kpi;
    operacionesGanadas: Kpi;
    valorGanado: Kpi;
    /** 0-100. null si no hubo cierres. */
    tasaCierre: number | null;
    /** 0-100 sobre los salientes del periodo. null si no hubo salientes. */
    porcentajeAgente: number | null;
    /** Minutos, promedio. null si ninguna conversacion tuvo respuesta. */
    primeraRespuestaMin: number | null;
    derivaciones: number;
  };
  porFuente: Array<{ fuente: string; cantidad: number }>;
  porCanal: Array<{ canal: string; cantidad: number }>;
  porDia: Array<{ dia: string; entrantes: number; salientes: number }>;
  salientesPorOrigen: Array<{ origen: string; cantidad: number }>;
  embudo: Array<{ etapa: string; color: string; cantidad: number; valor: number; ganada: boolean; perdida: boolean }>;
}

type Fila = Record<string, unknown>;
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export async function generarReporte(member: TeamMember, dias: RangoDias): Promise<Reporte> {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - dias * 86_400_000);
  const desdePrev = new Date(desde.getTime() - dias * 86_400_000);
  // Como texto ISO con cast: el driver no serializa Date en SQL crudo (db.execute).
  const desdeIso = desde.toISOString();
  const desdePrevIso = desdePrev.toISOString();
  // Filtro de propietario sobre el alias `ct` (contacts). Vacio para el admin.
  const owner = member.role === "admin" ? sql`` : sql`and ct.owner_id = ${member.id}`;

  const [contactos, conversaciones, mensajes, cierres, salientes, derivaciones, respuesta, fuente, canal, dia, embudo] =
    await Promise.all([
      db.execute(sql`
        select
          count(*) filter (where ct.created_at >= ${desdeIso}::timestamptz) as actual,
          count(*) filter (where ct.created_at >= ${desdePrevIso}::timestamptz and ct.created_at < ${desdeIso}::timestamptz) as anterior
        from contacts ct
        where ct.source <> 'simulador' ${owner}`),
      db.execute(sql`
        select
          count(*) filter (where c.created_at >= ${desdeIso}::timestamptz) as actual,
          count(*) filter (where c.created_at >= ${desdePrevIso}::timestamptz and c.created_at < ${desdeIso}::timestamptz) as anterior
        from conversations c join contacts ct on ct.id = c.contact_id
        where ct.source <> 'simulador' ${owner}`),
      db.execute(sql`
        select
          count(*) filter (where m.created_at >= ${desdeIso}::timestamptz) as actual,
          count(*) filter (where m.created_at >= ${desdePrevIso}::timestamptz and m.created_at < ${desdeIso}::timestamptz) as anterior
        from messages m
          join conversations c on c.id = m.conversation_id
          join contacts ct on ct.id = c.contact_id
        where m.direction = 'in' and ct.source <> 'simulador' ${owner}`),
      db.execute(sql`
        select
          count(*) filter (where s.is_won and d.updated_at >= ${desdeIso}::timestamptz) as ganadas,
          count(*) filter (where s.is_won and d.updated_at >= ${desdePrevIso}::timestamptz and d.updated_at < ${desdeIso}::timestamptz) as ganadas_prev,
          coalesce(sum(d.value) filter (where s.is_won and d.updated_at >= ${desdeIso}::timestamptz), 0) as valor,
          coalesce(sum(d.value) filter (where s.is_won and d.updated_at >= ${desdePrevIso}::timestamptz and d.updated_at < ${desdeIso}::timestamptz), 0) as valor_prev,
          count(*) filter (where s.is_lost and d.updated_at >= ${desdeIso}::timestamptz) as perdidas
        from deals d
          join pipeline_stages s on s.id = d.stage_id
          join contacts ct on ct.id = d.contact_id
        where ct.source <> 'simulador' ${owner}`),
      db.execute(sql`
        select coalesce(m.origin, 'human') as origen, count(*) as cantidad
        from messages m
          join conversations c on c.id = m.conversation_id
          join contacts ct on ct.id = c.contact_id
        where m.direction = 'out' and m.created_at >= ${desdeIso}::timestamptz and ct.source <> 'simulador' ${owner}
        group by 1 order by 2 desc`),
      db.execute(sql`
        select count(*) as cantidad
        from conversations c join contacts ct on ct.id = c.contact_id
        where c.needs_human_at >= ${desdeIso}::timestamptz and ct.source <> 'simulador' ${owner}`),
      db.execute(sql`
        select avg(extract(epoch from (t.primera_salida - t.primera_entrada)) / 60) as minutos
        from (
          select c.id,
            min(m.created_at) filter (where m.direction = 'in') as primera_entrada,
            min(m.created_at) filter (where m.direction = 'out') as primera_salida
          from conversations c
            join contacts ct on ct.id = c.contact_id
            join messages m on m.conversation_id = c.id
          where c.created_at >= ${desdeIso}::timestamptz and ct.source <> 'simulador' ${owner}
          group by c.id
        ) t
        where t.primera_salida > t.primera_entrada`),
      db.execute(sql`
        select ct.source as fuente, count(*) as cantidad
        from contacts ct
        where ct.created_at >= ${desdeIso}::timestamptz and ct.source <> 'simulador' ${owner}
        group by 1 order by 2 desc limit 8`),
      db.execute(sql`
        select c.channel as canal, count(*) as cantidad
        from conversations c join contacts ct on ct.id = c.contact_id
        where c.created_at >= ${desdeIso}::timestamptz and ct.source <> 'simulador' ${owner}
        group by 1 order by 2 desc`),
      db.execute(sql`
        select to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD') as dia,
          count(*) filter (where m.direction = 'in') as entrantes,
          count(*) filter (where m.direction = 'out') as salientes
        from messages m
          join conversations c on c.id = m.conversation_id
          join contacts ct on ct.id = c.contact_id
        where m.created_at >= ${desdeIso}::timestamptz and ct.source <> 'simulador' ${owner}
        group by 1 order by 1`),
      db.execute(sql`
        select s.name as etapa, s.color, s.is_won as ganada, s.is_lost as perdida,
          count(d.id) as cantidad, coalesce(sum(d.value), 0) as valor
        from pipeline_stages s
          join pipelines p on p.id = s.pipeline_id and p.is_default
          left join deals d on d.stage_id = s.id
          left join contacts ct on ct.id = d.contact_id
        where d.id is null or (ct.source <> 'simulador' ${owner})
        group by s.id, s.name, s.color, s.is_won, s.is_lost, s."order"
        order by s."order"`),
    ]);

  const f = (r: unknown): Fila => ((r as Fila[])[0] ?? {}) as Fila;
  const cierre = f(cierres);
  const ganadas = n(cierre.ganadas);
  const perdidas = n(cierre.perdidas);
  const salientesPorOrigen = (salientes as unknown as Fila[]).map((r) => ({ origen: String(r.origen), cantidad: n(r.cantidad) }));
  const totalSalientes = salientesPorOrigen.reduce((a, b) => a + b.cantidad, 0);
  const deAgente = salientesPorOrigen.find((s) => s.origen === "agent")?.cantidad ?? 0;
  const minutos = f(respuesta).minutos;

  // Serie diaria completa (dias sin mensajes = 0) para que la linea no salte.
  const porDiaMap = new Map((dia as unknown as Fila[]).map((r) => [String(r.dia), r]));
  const porDia: Reporte["porDia"] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(ahora.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const r = porDiaMap.get(d);
    porDia.push({ dia: d, entrantes: n(r?.entrantes), salientes: n(r?.salientes) });
  }

  return {
    dias,
    desde: desde.toISOString(),
    kpis: {
      contactosNuevos: { actual: n(f(contactos).actual), anterior: n(f(contactos).anterior) },
      conversacionesNuevas: { actual: n(f(conversaciones).actual), anterior: n(f(conversaciones).anterior) },
      mensajesEntrantes: { actual: n(f(mensajes).actual), anterior: n(f(mensajes).anterior) },
      operacionesGanadas: { actual: ganadas, anterior: n(cierre.ganadas_prev) },
      valorGanado: { actual: n(cierre.valor), anterior: n(cierre.valor_prev) },
      tasaCierre: ganadas + perdidas > 0 ? Math.round((ganadas / (ganadas + perdidas)) * 100) : null,
      porcentajeAgente: totalSalientes > 0 ? Math.round((deAgente / totalSalientes) * 100) : null,
      primeraRespuestaMin: minutos === null || minutos === undefined ? null : Math.round(Number(minutos) * 10) / 10,
      derivaciones: n(f(derivaciones).cantidad),
    },
    porFuente: (fuente as unknown as Fila[]).map((r) => ({ fuente: String(r.fuente), cantidad: n(r.cantidad) })),
    porCanal: (canal as unknown as Fila[]).map((r) => ({ canal: String(r.canal), cantidad: n(r.cantidad) })),
    porDia,
    salientesPorOrigen,
    embudo: (embudo as unknown as Fila[]).map((r) => ({
      etapa: String(r.etapa),
      color: String(r.color),
      cantidad: n(r.cantidad),
      valor: n(r.valor),
      ganada: Boolean(r.ganada),
      perdida: Boolean(r.perdida),
    })),
  };
}

/** Serie diaria de contactos nuevos (ultimos `dias`) y comparacion, para el dashboard. */
export async function serieContactos(member: TeamMember, dias = 7): Promise<{ serie: number[]; actual: number; anterior: number }> {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - dias * 86_400_000);
  const desdePrev = new Date(desde.getTime() - dias * 86_400_000);
  // Como texto ISO con cast: el driver no serializa Date en SQL crudo (db.execute).
  const desdePrevIso = desdePrev.toISOString();
  const owner = member.role === "admin" ? sql`` : sql`and ct.owner_id = ${member.id}`;
  const rows = (await db.execute(sql`
    select to_char(date_trunc('day', ct.created_at), 'YYYY-MM-DD') as dia, count(*) as cantidad
    from contacts ct
    where ct.created_at >= ${desdePrevIso}::timestamptz and ct.source <> 'simulador' ${owner}
    group by 1`)) as unknown as Fila[];
  const map = new Map(rows.map((r) => [String(r.dia), n(r.cantidad)]));
  const serie: number[] = [];
  let actual = 0;
  let anterior = 0;
  for (let i = 2 * dias - 1; i >= 0; i--) {
    const d = new Date(ahora.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const v = map.get(d) ?? 0;
    if (i < dias) {
      serie.push(v);
      actual += v;
    } else {
      anterior += v;
    }
  }
  return { serie, actual, anterior };
}
