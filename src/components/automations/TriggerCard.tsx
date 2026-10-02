"use client";

import { Filter, Plus, Trash2, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CatalogTrigger, RuleFilter } from "./types";

interface Props {
  triggers: CatalogTrigger[];
  trigger: string;
  filters: RuleFilter[];
  readOnly: boolean;
  onTriggerChange: (key: string) => void;
  onFiltersChange: (filters: RuleFilter[]) => void;
}

const OPS = [
  { value: "eq", label: "es" },
  { value: "neq", label: "no es" },
];

/**
 * Primera tarjeta del flujo: que lo dispara y con que filtros. Cambiar el disparador
 * limpia los filtros, porque los campos son de cada disparador.
 */
export function TriggerCard({
  triggers,
  trigger,
  filters,
  readOnly,
  onTriggerChange,
  onFiltersChange,
}: Props) {
  const def = triggers.find((t) => t.key === trigger);
  const fields = def?.filterFields ?? [];
  const unused = fields.filter((f) => !filters.some((x) => x.field === f.key));
  const triggerItems = triggers.map((t) => ({ value: t.key, label: t.label }));
  const fieldItems = fields.map((f) => ({ value: f.key, label: f.label }));

  const update = (i: number, patch: Partial<RuleFilter>) =>
    onFiltersChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onFiltersChange(filters.filter((_, idx) => idx !== i));
  const add = () => {
    const field = unused[0];
    if (!field) return;
    onFiltersChange([
      ...filters,
      { field: field.key, op: "eq", value: field.options[0]?.value ?? "" },
    ]);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(10,22,40,0.04),0_8px_24px_-12px_rgba(10,22,40,0.18)] overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-[#0A1628] to-[#1E3A5F] text-white">
        <div className="h-9 w-9 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55 font-semibold">
            Disparador
          </p>
          {readOnly ? (
            <p className="text-sm font-semibold font-heading truncate">{def?.label ?? trigger}</p>
          ) : (
            <Select
              value={trigger}
              items={triggerItems}
              onValueChange={(v) => v && onTriggerChange(v)}
            >
              <SelectTrigger className="mt-0.5 h-8 w-full max-w-sm cursor-pointer border-white/20 bg-white/10 text-white hover:bg-white/15 focus-visible:ring-white/30 [&_svg]:text-white/70">
                <SelectValue placeholder="Elige un disparador" />
              </SelectTrigger>
              <SelectContent>
                {triggers.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {def && <p className="text-[13px] text-muted-foreground leading-relaxed">{def.description}</p>}

        {fields.length > 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <Filter className="h-3 w-3" />
              Filtros
              <span className="ml-auto font-normal normal-case tracking-normal text-muted-foreground/80">
                {filters.length === 0 ? "siempre que pase el disparador" : "todos deben cumplirse"}
              </span>
            </div>

            {filters.map((f, i) => {
              const field = fields.find((x) => x.key === f.field);
              const options = field?.options ?? [];
              return (
                <div
                  key={`${f.field}-${i}`}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1.4fr)_auto] gap-2 items-center rounded-lg bg-card border border-border/80 p-2"
                >
                  <Select
                    value={f.field}
                    items={fieldItems}
                    disabled={readOnly}
                    onValueChange={(v) => {
                      if (!v) return;
                      const nf = fields.find((x) => x.key === v);
                      update(i, { field: v, value: nf?.options[0]?.value ?? "" });
                    }}
                  >
                    <SelectTrigger className="h-8 w-full text-xs cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((x) => (
                        <SelectItem key={x.key} value={x.key}>
                          {x.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={f.op}
                    items={OPS}
                    disabled={readOnly}
                    onValueChange={(v) => v && update(i, { op: v as RuleFilter["op"] })}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-[84px] text-xs cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={f.value}
                    items={options}
                    disabled={readOnly}
                    onValueChange={(v) => v && update(i, { value: v })}
                  >
                    <SelectTrigger className="h-8 w-full text-xs cursor-pointer">
                      <SelectValue placeholder="Elige…" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => remove(i)}
                    aria-label="Quitar filtro"
                    className={cn(
                      "h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer justify-self-end",
                      readOnly && "hidden"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {!readOnly && unused.length > 0 && (
              <button
                type="button"
                onClick={add}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer pt-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir filtro
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
