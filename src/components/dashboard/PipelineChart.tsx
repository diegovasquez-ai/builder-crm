"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/constants";

interface StageData {
  name: string;
  count: number;
  value: number;
  color: string;
}

interface PipelineChartProps {
  data: StageData[];
}

interface TooltipPayloadItem {
  payload: StageData;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || !payload.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-[12px]">
      <p className="font-semibold mb-1" style={{ color: datum.color }}>
        {datum.name}
      </p>
      <div className="space-y-0.5 text-muted-foreground">
        <p>
          <span className="tabular-nums font-semibold text-foreground">
            {datum.count}
          </span>{" "}
          deals
        </p>
        <p>
          <span className="tabular-nums font-semibold text-foreground">
            {formatCurrency(datum.value)}
          </span>{" "}
          en valor
        </p>
      </div>
    </div>
  );
}

export function PipelineChart({ data }: PipelineChartProps) {
  return (
    <Card className="surface-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight font-heading">
          Pipeline de Ventas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Distribucion de deals por etapa
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No hay deals en el pipeline
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 5, left: -16 }}>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="var(--border)"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
