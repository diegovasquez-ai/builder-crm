"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FlowEditor } from "./FlowEditor";
import type { Catalog, RuleRecord } from "./types";

interface Props {
  /** undefined = regla nueva. */
  ruleKey?: string;
}

/** Carga catalogo + regla + rol, y recien ahi monta el editor. */
export function FlowEditorLoader({ ruleKey }: Props) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; catalog: Catalog; rule: RuleRecord | null; isAdmin: boolean }
  >({ status: "loading" });

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/automations/catalog").then((r) => (r.ok ? r.json() : Promise.reject())),
      ruleKey
        ? fetch(`/api/automations/${ruleKey}`).then((r) => (r.ok ? r.json() : null))
        : Promise.resolve(null),
      fetch("/api/team/me").then((r) => (r.ok ? r.json() : { member: null })),
    ])
      .then(([catalog, rule, me]) => {
        if (!alive) return;
        if (ruleKey && !rule) {
          setState({ status: "error", message: "La regla no existe." });
          return;
        }
        setState({ status: "ready", catalog, rule, isAdmin: me.member?.role === "admin" });
      })
      .catch(() => {
        if (alive) setState({ status: "error", message: "No se pudo cargar el catalogo." });
      });
    return () => {
      alive = false;
    };
  }, [ruleKey]);

  return (
    <div>
      <PageHeader
        title={ruleKey ? "Editar regla" : "Nueva regla"}
        subtitle="Elige que la dispara, filtra cuando aplica y encadena lo que hace"
      />
      {state.status === "loading" && (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      {state.status === "ready" && (
        <FlowEditor catalog={state.catalog} initial={state.rule} isAdmin={state.isAdmin} />
      )}
    </div>
  );
}
