"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { camposContacto, getConfig } from "@/lib/config";
import { formatearValorCampo, type ValoresCampos } from "@/lib/config/campos";
import type { CampoConfig } from "@/lib/config/schema";

/**
 * Campos personalizados del contacto, definidos en config/cliente.ts
 * (`contacto.campos`). Dos piezas:
 *  - `CamposPersonalizadosInputs`: los inputs para el formulario de alta/edicion.
 *  - `CamposPersonalizadosLista`: la lectura en la ficha y en el panel del chat.
 * Si no hay campos configurados, no renderizan nada.
 */

const NINGUNO = "__ninguno__";

interface InputsProps {
  valores: ValoresCampos;
  onChange: (siguiente: ValoresCampos) => void;
  disabled?: boolean;
}

export function CamposPersonalizadosInputs({ valores, onChange, disabled }: InputsProps) {
  const campos = camposContacto();
  if (campos.length === 0) return null;

  const set = (clave: string, valor: ValoresCampos[string]) =>
    onChange({ ...valores, [clave]: valor });

  return (
    <div className="space-y-4">
      {campos.map((campo) => (
        <div key={campo.clave} className="space-y-2">
          <Label htmlFor={`cp-${campo.clave}`}>
            {campo.etiqueta}
            {campo.requerido && " *"}
          </Label>
          <CampoInput campo={campo} valor={valores[campo.clave]} onChange={(v) => set(campo.clave, v)} disabled={disabled} />
          {campo.ayuda && <p className="text-xs text-muted-foreground">{campo.ayuda}</p>}
        </div>
      ))}
    </div>
  );
}

function CampoInput({
  campo,
  valor,
  onChange,
  disabled,
}: {
  campo: CampoConfig;
  valor: ValoresCampos[string] | undefined;
  onChange: (v: ValoresCampos[string]) => void;
  disabled?: boolean;
}) {
  const id = `cp-${campo.clave}`;
  switch (campo.tipo) {
    case "seleccion":
      return (
        <Select
          value={valor === null || valor === undefined ? NINGUNO : String(valor)}
          onValueChange={(v) => onChange(v === NINGUNO || v === null ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="cursor-pointer">
            <SelectValue placeholder="Elegir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>Sin definir</SelectItem>
            {campo.opciones?.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "booleano":
      return (
        <Select
          value={valor === true ? "si" : valor === false ? "no" : NINGUNO}
          onValueChange={(v) => onChange(v === "si" ? true : v === "no" ? false : null)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="cursor-pointer">
            <SelectValue placeholder="Elegir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>Sin definir</SelectItem>
            <SelectItem value="si">Si</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      );
    case "numero":
      return (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={valor === null || valor === undefined ? "" : String(valor)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
        />
      );
    case "fecha":
      return (
        <Input
          id={id}
          type="date"
          value={valor === null || valor === undefined ? "" : String(valor)}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
      );
    default:
      return (
        <Input
          id={id}
          value={valor === null || valor === undefined ? "" : String(valor)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}

interface ListaProps {
  valores: Record<string, unknown> | null | undefined;
  /** Compacto: una linea por campo, sin borde; para el panel lateral del chat. */
  compacto?: boolean;
  /** Mostrar tambien los campos vacios. */
  mostrarVacios?: boolean;
}

export function CamposPersonalizadosLista({ valores, compacto, mostrarVacios }: ListaProps) {
  const campos = camposContacto();
  const { moneda } = getConfig();
  if (campos.length === 0) return null;
  const visibles = campos.filter((c) => {
    const v = valores?.[c.clave];
    return mostrarVacios || (v !== null && v !== undefined && v !== "");
  });
  if (visibles.length === 0) return null;

  return (
    <dl className={compacto ? "space-y-1" : "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t"}>
      {visibles.map((c) => (
        <div key={c.clave} className={compacto ? "flex justify-between gap-2 text-xs" : "text-sm"}>
          <dt className="text-muted-foreground">{c.etiqueta}</dt>
          <dd className={compacto ? "font-medium text-right truncate" : "font-medium"}>
            {formatearValorCampo(c, valores?.[c.clave], moneda)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
