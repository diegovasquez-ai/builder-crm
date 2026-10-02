import { Building2 } from "lucide-react";
import type { ManifiestoModulo } from "@/lib/modules/types";

/**
 * Modulo propiedades: catalogo de propiedades con busqueda por criterios (semantica
 * si hay OPENAI_API_KEY, por filtros si no) y por direccion o link de portal, para
 * que el agente responda con datos reales. Sincroniza desde Tokko Broker (opcional).
 */
const manifiesto: ManifiestoModulo = {
  nombre: "propiedades",
  titulo: "Propiedades",
  descripcion: "Catalogo de propiedades y busqueda para el agente (Tokko opcional).",
  version: "1.0.0",
  nav: [{ etiqueta: "Propiedades", icono: Building2, seccion: "Operaciones" }],
};

export default manifiesto;
