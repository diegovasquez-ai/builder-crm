"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TriggerCard } from "./TriggerCard";
import { ActionCard, ACTION_STYLE } from "./ActionCard";
import type { Catalog, RuleAction, RuleDraft, RuleRecord } from "./types";

interface Props {
  catalog: Catalog;
  /** null = regla nueva. */
  initial: RuleRecord | null;
  isAdmin: boolean;
}

function emptyDraft(catalog: Catalog): RuleDraft {
  return {
    name: "",
    trigger: catalog.triggers[0]?.key ?? "",
    filters: [],
    actions: [],
    enabled: false,
  };
}

/**
 * El constructor: nombre y estado arriba, disparador, y la cadena de acciones con un
 * (+) entre cada paso. Todo el estado vive aca; las tarjetas solo reportan cambios.
 */
export function FlowEditor({ catalog, initial, isAdmin }: Props) {
  const router = useRouter();
  const readOnly = !isAdmin;
  const [draft, setDraft] = useState<RuleDraft>(() =>
    initial
      ? {
          name: initial.name,
          trigger: initial.trigger,
          filters: initial.filters,
          actions: initial.actions,
          enabled: initial.enabled,
        }
      : emptyDraft(catalog)
  );
  const [saving, setSaving] = useState(false);

  const triggerDef = catalog.triggers.find((t) => t.key === draft.trigger);
  const placeholders = triggerDef?.placeholders ?? [];

  const setActions = (actions: RuleAction[]) => setDraft((d) => ({ ...d, actions }));

  const addAction = (type: string, at: number) => {
    const def = catalog.actions.find((a) => a.key === type);
    if (!def) return;
    const params: Record<string, string> = {};
    for (const p of def.params) {
      params[p.key] = p.type === "select" ? (p.options?.[0]?.value ?? "") : "";
    }
    const next = [...draft.actions];
    next.splice(at, 0, { type, params });
    setActions(next);
  };

  const moveAction = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.actions.length) return;
    const next = [...draft.actions];
    [next[i], next[j]] = [next[j], next[i]];
    setActions(next);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Ponle un nombre a la regla");
      return;
    }
    if (draft.actions.length === 0) {
      toast.error("Agrega al menos una accion");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(initial ? `/api/automations/${initial.key}` : "/api/automations", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "No se pudo guardar");
        return;
      }
      toast.success(draft.enabled ? "Regla publicada" : "Regla guardada como borrador");
      router.push("/automatizaciones");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm(`Eliminar "${initial.name}"? Esto no se puede deshacer.`)) return;
    const res = await fetch(`/api/automations/${initial.key}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error ?? "No se pudo eliminar");
      return;
    }
    toast.success("Regla eliminada");
    router.push("/automatizaciones");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Cabecera: volver, nombre, estado, guardar */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <button
          type="button"
          onClick={() => router.push("/automatizaciones")}
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Volver a las reglas"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <input
          value={draft.name}
          disabled={readOnly}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Nombre de la regla"
          className="flex-1 min-w-50 h-10 bg-transparent text-lg md:text-xl font-heading font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 border-b border-transparent focus:border-primary/40 transition-colors disabled:opacity-100"
        />

        <StatusToggle
          enabled={draft.enabled}
          disabled={readOnly}
          onChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
        />

        {!readOnly && (
          <Button onClick={save} disabled={saving} className="cursor-pointer h-9 px-4">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </div>

      {/* Lienzo */}
      <div className="rounded-2xl border border-border bg-[#F6F8FB] bg-[radial-gradient(circle,#c9d0dc_1px,transparent_1px)] bg-size-[20px_20px] px-4 py-8 md:py-10">
        <div className="mx-auto w-full max-w-xl">
          <TriggerCard
            triggers={catalog.triggers}
            trigger={draft.trigger}
            filters={draft.filters}
            readOnly={readOnly}
            onTriggerChange={(key) => setDraft((d) => ({ ...d, trigger: key, filters: [] }))}
            onFiltersChange={(filters) => setDraft((d) => ({ ...d, filters }))}
          />

          <Connector>
            {!readOnly && <AddButton catalog={catalog} onPick={(t) => addAction(t, 0)} />}
          </Connector>

          {draft.actions.map((a, i) => (
            <div key={`${a.type}-${i}`}>
              <ActionCard
                index={i}
                total={draft.actions.length}
                action={a}
                def={catalog.actions.find((x) => x.key === a.type)}
                placeholders={placeholders}
                readOnly={readOnly}
                onChange={(params) =>
                  setActions(draft.actions.map((x, idx) => (idx === i ? { ...x, params } : x)))
                }
                onMove={(dir) => moveAction(i, dir)}
                onRemove={() => setActions(draft.actions.filter((_, idx) => idx !== i))}
              />
              <Connector>
                {!readOnly && (
                  <AddButton catalog={catalog} onPick={(t) => addAction(t, i + 1)} />
                )}
              </Connector>
            </div>
          ))}

          {draft.actions.length === 0 && !readOnly && (
            <p className="text-center text-xs text-muted-foreground -mt-3 mb-5">
              Toca el <span className="font-semibold">+</span> para agregar la primera accion.
            </p>
          )}

          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground shadow-sm">
              <Check className="h-3 w-3" />
              FIN
            </span>
          </div>
        </div>
      </div>

      {initial && isAdmin && initial.source === "user" && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar regla
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusToggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border pl-1.5 pr-3 h-9 text-xs font-medium cursor-pointer transition-colors select-none",
        enabled
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
          : "border-border bg-muted/50 text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      {enabled ? "Publicada" : "Borrador"}
    </button>
  );
}

/** Linea vertical entre pasos, con espacio para el boton (+). */
function Connector({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-1.5">
      <div className="h-5 w-0.5 bg-border" />
      {children ?? <div className="h-2" />}
      <div className="h-5 w-0.5 bg-border" />
      <div className="-mt-1 h-0 w-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-border" />
    </div>
  );
}

function AddButton({ catalog, onPick }: { catalog: Catalog; onPick: (type: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-border bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary hover:shadow-md cursor-pointer transition-all"
            aria-label="Agregar accion"
          />
        }
      >
        <Plus className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-72 p-1.5">
        <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          Agregar accion
        </p>
        {catalog.actions.map((a) => {
          const style = ACTION_STYLE[a.key] ?? ACTION_STYLE.push;
          const Icon = style.icon;
          return (
            <DropdownMenuItem
              key={a.key}
              onClick={() => onPick(a.key)}
              className="items-start gap-2.5 rounded-lg px-2 py-2 cursor-pointer"
            >
              <span className={cn("mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0", style.bg, style.fg)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{a.label}</span>
                <span className="block text-xs text-muted-foreground leading-snug">{a.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
