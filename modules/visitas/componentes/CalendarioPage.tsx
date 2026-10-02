"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { API_VISITAS, ETIQUETA_ESTADO, type EstadoVisita, type VisitaConContacto } from "../tipos";

const STATUS_DOT: Record<EstadoVisita, string> = {
  coordinating: "bg-amber-500",
  scheduled: "bg-emerald-500",
  completed: "bg-sky-500",
  cancelled: "bg-rose-500",
};

export function CalendarioPage() {
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [visits, setVisits] = useState<VisitaConContacto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(API_VISITAS)
      .then((r) => r.json())
      .then((data: VisitaConContacto[]) => {
        if (!active) return;
        setVisits(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [cursor]);

  const visitsByDay = useMemo(() => {
    const map = new Map<string, VisitaConContacto[]>();
    for (const v of visits) {
      if (!v.scheduledAt) continue;
      const date = new Date(v.scheduledAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = format(date, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(v);
      map.set(key, list);
    }
    return map;
  }, [visits]);

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedVisits = (visitsByDay.get(selectedKey) ?? []).sort(
    (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
  );

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Visitas programadas por mes" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="surface-card lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))} className="cursor-pointer h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-base font-semibold tracking-tight font-heading min-w-[150px] text-center capitalize">
                  {format(cursor, "MMMM yyyy", { locale: es })}
                </h2>
                <Button variant="outline" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))} className="cursor-pointer h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setCursor(now);
                  setSelected(now);
                }}
                className="cursor-pointer"
              >
                Hoy
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-1">
              {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                <div key={d} className="px-2 py-1.5 text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayVisits = visitsByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, cursor);
                const isSelected = isSameDay(day, selected);
                const today = isToday(day);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={cn(
                      "relative min-h-[72px] rounded-md border p-1.5 text-left transition-colors cursor-pointer",
                      inMonth ? "bg-card" : "bg-muted/20",
                      isSelected ? "border-primary ring-1 ring-primary/30" : "border-border/60 hover:border-border"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center text-xs font-medium h-5 min-w-5 px-1 rounded-full",
                        today && "bg-primary text-primary-foreground",
                        !inMonth && !today && "text-muted-foreground/60"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayVisits.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayVisits.slice(0, 2).map((v) => (
                          <div key={v.id} className="flex items-center gap-1 text-[10.5px] leading-tight">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[v.status])} />
                            <span className="truncate">
                              {format(new Date(v.scheduledAt!), "HH:mm")} {v.contactName ?? ""}
                            </span>
                          </div>
                        ))}
                        {dayVisits.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayVisits.length - 2} mas</div>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold tracking-tight font-heading capitalize">{format(selected, "EEEE d 'de' MMMM", { locale: es })}</h3>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : selectedVisits.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sin visitas para este dia.</p>
            ) : (
              <div className="space-y-2">
                {selectedVisits.map((v) => (
                  <div key={v.id} className="rounded-lg border border-border/60 bg-card p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[v.status])} />
                      <span className="text-xs font-semibold">{format(new Date(v.scheduledAt!), "HH:mm")}</span>
                      <span className="text-[10.5px] text-muted-foreground">{ETIQUETA_ESTADO[v.status]}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{v.contactName ?? "Sin contacto"}</p>
                    {v.propertyAddress && <p className="text-xs text-muted-foreground truncate">{v.propertyAddress}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border/60 pt-3 mt-2 space-y-1.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Estados</p>
              {(Object.keys(ETIQUETA_ESTADO) as EstadoVisita[]).map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
                  <span>{ETIQUETA_ESTADO[s]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
