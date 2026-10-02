"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, SOURCE_LABELS } from "@/lib/constants";
import { CHANNEL_LABELS } from "@/lib/channels/types";
import { cn } from "@/lib/utils";
import type { Reporte, RangoDias, Kpi } from "@/lib/reportes";
import type { LeadSource } from "@/types";
import type { Channel } from "@/lib/channels/types";

/**
 * Reportes con datos reales. Paleta de series validada (ver skill dataviz, slots 1 y
 * 2 de la paleta de referencia): una sola serie va en --viz-1; la linea de mensajes
 * usa dos series con leyenda. Las etapas del embudo usan su propio color (es la
 * identidad de la etapa en todo el CRM) y llevan el valor directo al final de la barra.
 */

const ESTILO = `
.viz-root { --viz-1: #2a78d6; --viz-2: #eb6834; --viz-grid: #e1e0d9; --viz-axis: #c3c2b7; }
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root { --viz-1: #3987e5; --viz-2: #d95926; --viz-grid: #2c2c2a; --viz-axis: #383835; }
}
:root[data-theme="dark"] .viz-root { --viz-1: #3987e5; --viz-2: #d95926; --viz-grid: #2c2c2a; --viz-axis: #383835; }
`;

const RANGOS: RangoDias[] = [7, 30, 90];

function compacto(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString("es");
}

function Delta({ kpi, bueno = true }: { kpi: Kpi; bueno?: boolean }) {
  if (kpi.anterior === 0 && kpi.actual === 0) return <span className="text-[11px] text-muted-foreground">sin datos previos</span>;
  if (kpi.anterior === 0) return <span className="text-[11px] text-muted-foreground">nuevo en el periodo</span>;
  const pct = Math.round(((kpi.actual - kpi.anterior) / kpi.anterior) * 100);
  const sube = pct >= 0;
  const positivo = bueno ? sube : !sube;
  return (
    <span className={cn("text-[11px] font-medium", positivo ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
      {sube ? "+" : ""}
      {pct}% <span className="font-normal text-muted-foreground">vs periodo anterior</span>
    </span>
  );
}

function Tile({ titulo, valor, sub }: { titulo: string; valor: string; sub?: React.ReactNode }) {
  return (
    <Card className="surface-card">
      <CardHeader className="pb-1">
        <CardTitle className="text-[13px] font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight font-heading truncate">{valor}</div>
        <div className="mt-1 min-h-4">{sub}</div>
      </CardContent>
    </Card>
  );
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-[12px]">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value.toLocaleString("es")}</span>
        </p>
      ))}
    </div>
  );
}

const EJE = { fontSize: 11, fill: "var(--muted-foreground)" };

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground text-center py-12">{texto}</p>;
}

export function Reportes({ reporte }: { reporte: Reporte }) {
  const { kpis, dias } = reporte;
  const porDia = reporte.porDia.map((d) => ({ ...d, etiqueta: d.dia.slice(5).replace("-", "/") }));
  const fuentes = reporte.porFuente.map((f) => ({ nombre: SOURCE_LABELS[f.fuente as LeadSource] ?? f.fuente, cantidad: f.cantidad }));
  const canales = reporte.porCanal.map((c) => ({ nombre: CHANNEL_LABELS[c.canal as Channel] ?? c.canal, cantidad: c.cantidad }));
  const humano = reporte.salientesPorOrigen.filter((s) => s.origen !== "agent").reduce((a, b) => a + b.cantidad, 0);
  const agente = reporte.salientesPorOrigen.find((s) => s.origen === "agent")?.cantidad ?? 0;

  return (
    <div className="viz-root space-y-5">
      <style dangerouslySetInnerHTML={{ __html: ESTILO }} />

      <div className="flex items-center gap-1">
        {RANGOS.map((r) => (
          <Link
            key={r}
            href={`/reportes?dias=${r}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              r === dias ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Ultimos {r} dias
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile titulo="Contactos nuevos" valor={compacto(kpis.contactosNuevos.actual)} sub={<Delta kpi={kpis.contactosNuevos} />} />
        <Tile titulo="Conversaciones nuevas" valor={compacto(kpis.conversacionesNuevas.actual)} sub={<Delta kpi={kpis.conversacionesNuevas} />} />
        <Tile titulo="Mensajes recibidos" valor={compacto(kpis.mensajesEntrantes.actual)} sub={<Delta kpi={kpis.mensajesEntrantes} />} />
        <Tile
          titulo="Operaciones ganadas"
          valor={compacto(kpis.operacionesGanadas.actual)}
          sub={
            <span className="text-[11px] text-muted-foreground">
              {formatCurrency(kpis.valorGanado.actual)} · <Delta kpi={kpis.operacionesGanadas} />
            </span>
          }
        />
        <Tile
          titulo="Tasa de cierre"
          valor={kpis.tasaCierre === null ? "—" : `${kpis.tasaCierre}%`}
          sub={<span className="text-[11px] text-muted-foreground">{kpis.tasaCierre === null ? "sin cierres en el periodo" : "ganadas sobre cerradas"}</span>}
        />
        <Tile
          titulo="Respondido por el agente"
          valor={kpis.porcentajeAgente === null ? "—" : `${kpis.porcentajeAgente}%`}
          sub={<span className="text-[11px] text-muted-foreground">{agente.toLocaleString("es")} del agente · {humano.toLocaleString("es")} de personas</span>}
        />
        <Tile
          titulo="Primera respuesta"
          valor={kpis.primeraRespuestaMin === null ? "—" : kpis.primeraRespuestaMin < 60 ? `${kpis.primeraRespuestaMin} min` : `${(kpis.primeraRespuestaMin / 60).toFixed(1)} h`}
          sub={<span className="text-[11px] text-muted-foreground">promedio en conversaciones nuevas</span>}
        />
        <Tile
          titulo="Derivadas a humano"
          valor={compacto(kpis.derivaciones)}
          sub={<span className="text-[11px] text-muted-foreground">conversaciones que pidieron una persona</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="surface-card lg:col-span-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight font-heading">Mensajes por dia</CardTitle>
            <p className="text-xs text-muted-foreground">Entrantes de clientes y salientes del equipo y el agente</p>
          </CardHeader>
          <CardContent>
            {porDia.every((d) => d.entrantes === 0 && d.salientes === 0) ? (
              <Vacio texto="Sin mensajes en el periodo." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={porDia} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={EJE} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--viz-axis)" }} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" name="Entrantes" dataKey="entrantes" stroke="var(--viz-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
                  <Line type="monotone" name="Salientes" dataKey="salientes" stroke="var(--viz-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight font-heading">Contactos por fuente</CardTitle>
            <p className="text-xs text-muted-foreground">Nuevos en el periodo</p>
          </CardHeader>
          <CardContent>
            {fuentes.length === 0 ? (
              <Vacio texto="Sin contactos nuevos en el periodo." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, fuentes.length * 36)}>
                <BarChart data={fuentes} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }} barSize={18}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar name="Contactos" dataKey="cantidad" fill="var(--viz-1)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="cantidad" position="right" style={{ fontSize: 11, fill: "var(--foreground)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight font-heading">Conversaciones por canal</CardTitle>
            <p className="text-xs text-muted-foreground">Hilos nuevos en el periodo</p>
          </CardHeader>
          <CardContent>
            {canales.length === 0 ? (
              <Vacio texto="Sin conversaciones nuevas en el periodo." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, canales.length * 36)}>
                <BarChart data={canales} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }} barSize={18}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar name="Conversaciones" dataKey="cantidad" fill="var(--viz-1)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="cantidad" position="right" style={{ fontSize: 11, fill: "var(--foreground)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card lg:col-span-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight font-heading">Embudo del pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">Operaciones abiertas y cerradas por etapa (total, no solo el periodo)</p>
          </CardHeader>
          <CardContent>
            {reporte.embudo.length === 0 ? (
              <Vacio texto="No hay pipeline configurado." />
            ) : reporte.embudo.every((e) => e.cantidad === 0) ? (
              <Vacio texto="Todavia no hay operaciones en el pipeline." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, reporte.embudo.length * 36)}>
                <BarChart data={reporte.embudo} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 8 }} barSize={18}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="etapa" tick={EJE} tickLine={false} axisLine={false} width={140} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const e = payload[0].payload as Reporte["embudo"][number];
                      return (
                        <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-[12px]">
                          <p className="font-medium mb-1">{e.etapa}</p>
                          <p className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{e.cantidad}</span> operaciones ·{" "}
                            <span className="font-semibold text-foreground">{formatCurrency(e.valor)}</span>
                          </p>
                        </div>
                      );
                    }}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Bar name="Operaciones" dataKey="cantidad" radius={[0, 4, 4, 0]}>
                    {reporte.embudo.map((e) => (
                      <Cell key={e.etapa} fill={e.color} />
                    ))}
                    <LabelList
                      dataKey="cantidad"
                      position="right"
                      content={({ x, y, width, height, value, index }) => {
                        const e = reporte.embudo[index ?? 0];
                        if (!e || !value) return null;
                        const px = Number(x) + Number(width) + 6;
                        const py = Number(y) + Number(height) / 2 + 4;
                        return (
                          <text x={px} y={py} style={{ fontSize: 11, fill: "var(--foreground)" }}>
                            {value} · {formatCurrency(e.valor)}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
