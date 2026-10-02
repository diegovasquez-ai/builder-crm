"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Clock,
  History,
  Plus,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ACTION_STYLE } from "./ActionCard";
import type { RuleListItem, RunItem } from "./types";

/** Lista de reglas con ON/OFF, acceso al editor, y el historial de ejecuciones. */
export function AutomationsList() {
  const [items, setItems] = useState<RuleListItem[]>([]);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [list, me] = await Promise.all([
      fetch("/api/automations").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/team/me").then((r) => (r.ok ? r.json() : { member: null })),
    ]);
    return { list: list as RuleListItem[], admin: me.member?.role === "admin" };
  }, []);

  const apply = useCallback((data: { list: RuleListItem[]; admin: boolean }) => {
    setItems(data.list);
    setIsAdmin(data.admin);
    setLoading(false);
  }, []);

  const loadRuns = useCallback(
    () =>
      fetch("/api/automations/runs?limit=40").then((r) =>
        r.ok ? (r.json() as Promise<RunItem[]>) : []
      ),
    []
  );

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) apply(data);
    });
    return () => {
      alive = false;
    };
  }, [load, apply]);

  useEffect(() => {
    if (!showHistory) return;
    let alive = true;
    loadRuns().then((list) => {
      if (alive) setRuns(list);
    });
    return () => {
      alive = false;
    };
  }, [showHistory, loadRuns]);

  const toggle = async (a: RuleListItem) => {
    const res = await fetch(`/api/automations/${a.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "No se pudo cambiar");
      return;
    }
    toast.success(a.enabled ? "Regla apagada" : "Regla publicada");
    apply(await load());
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando reglas...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">
          Cada regla es <strong className="text-foreground">cuando pasa algo → hacer una o varias cosas</strong>.
          Se arman aca y corren solas.
        </p>
        {isAdmin && (
          <Button
            className="cursor-pointer shrink-0"
            nativeButton={false}
            render={<Link href="/automatizaciones/nueva" />}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva regla
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <div className="mx-auto h-11 w-11 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Workflow className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Todavia no hay reglas</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-1">
              Crea la primera con el boton de arriba.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {items.map((a) => {
          const total = a.stats.done + a.stats.skipped + a.stats.failed;
          return (
            <div
              key={a.key}
              className={cn(
                "group rounded-2xl border border-border bg-card p-4 flex gap-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(10,22,40,0.18)]",
                !a.enabled && "bg-muted/20"
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1",
                  a.enabled
                    ? "bg-[#0A1628] text-white ring-black/10"
                    : "bg-muted text-muted-foreground ring-border"
                )}
              >
                <Zap className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/automatizaciones/${a.key}`}
                    className="text-[15px] font-semibold font-heading tracking-tight hover:underline"
                  >
                    {a.name}
                  </Link>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide",
                      a.enabled
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", a.enabled ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                    {a.enabled ? "PUBLICADA" : "BORRADOR"}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-foreground/80">
                    <span className="text-muted-foreground">Cuando</span>
                    <span className="font-medium">{a.summary.when}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {a.actions.length === 0 ? (
                    <span className="text-muted-foreground">sin acciones</span>
                  ) : (
                    a.actions.map((act, i) => {
                      const style = ACTION_STYLE[act.type] ?? ACTION_STYLE.push;
                      const Icon = style.icon;
                      const label = a.summary.then.split(" · ")[i] ?? act.type;
                      return (
                        <span
                          key={i}
                          className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ring-1", style.bg, style.fg, style.ring)}
                        >
                          <Icon className="h-3 w-3" />
                          <span className="font-medium">{label}</span>
                        </span>
                      );
                    })
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Ultimas 24 h:{" "}
                  {total === 0 ? (
                    "sin ejecuciones"
                  ) : (
                    <>
                      <span className="text-emerald-700 font-medium">{a.stats.done} ejecutada{a.stats.done === 1 ? "" : "s"}</span>
                      {a.stats.skipped > 0 && ` · ${a.stats.skipped} omitida${a.stats.skipped === 1 ? "" : "s"}`}
                      {a.stats.failed > 0 && (
                        <span className="text-destructive font-medium"> · {a.stats.failed} con error</span>
                      )}
                      {a.stats.pending > 0 && ` · ${a.stats.pending} pendiente${a.stats.pending === 1 ? "" : "s"}`}
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.enabled}
                  disabled={!isAdmin}
                  onClick={() => toggle(a)}
                  title={isAdmin ? (a.enabled ? "Apagar" : "Publicar") : "Solo un administrador puede cambiarlo"}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
                    a.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      a.enabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
                <Link
                  href={`/automatizaciones/${a.key}`}
                  className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
                >
                  {isAdmin ? "Editar" : "Ver"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory((v) => !v)}
          className="cursor-pointer text-xs"
        >
          <History className="h-3.5 w-3.5 mr-1" />
          {showHistory ? "Ocultar historial" : "Ver historial"}
        </Button>

        {showHistory && (
          <div className="mt-2 rounded-2xl border divide-y max-h-96 overflow-y-auto bg-card">
            {runs.length === 0 && (
              <p className="text-xs text-muted-foreground px-4 py-6 text-center">Todavia no hay ejecuciones.</p>
            )}
            {runs.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3 text-xs">
                <RunIcon status={r.status} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate">
                    <span className="font-medium">{r.contactName ?? "Contacto"}</span>
                    <span className="text-muted-foreground"> · {r.automationName}</span>
                  </p>
                  {r.result && r.result.length > 0 ? (
                    <ul className="text-muted-foreground space-y-0.5">
                      {r.result.map((step, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <RunIcon status={step.status} small />
                          <span className="truncate">{step.detail}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground truncate">{r.error ?? r.status}</p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: es })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RunIcon({ status, small }: { status: string; small?: boolean }) {
  const cls = cn("shrink-0", small ? "h-3 w-3" : "h-4 w-4 mt-0.5");
  if (status === "done") return <CheckCircle2 className={cn(cls, "text-emerald-500")} />;
  if (status === "failed") return <XCircle className={cn(cls, "text-destructive")} />;
  if (status === "skipped") return <CircleSlash className={cn(cls, "text-muted-foreground")} />;
  return <Clock className={cn(cls, "text-amber-500")} />;
}
