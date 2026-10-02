// GENERADO por scripts/generar-registro-modulos.mjs a partir de config/modulos.json.
// No editar a mano: se reescribe al arrancar y al construir.
import type { ModuloServidor } from "./types";
import s_propiedades from "@modules/propiedades/servidor";
import s_visitas from "@modules/visitas/servidor";

export const MODULOS_SERVIDOR: Record<string, ModuloServidor> = {
  propiedades: s_propiedades,
  visitas: s_visitas,
};
