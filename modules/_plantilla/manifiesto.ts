import { Package } from "lucide-react";
import type { ManifiestoModulo } from "@/lib/modules/types";

/**
 * PLANTILLA DE MODULO — copiar la carpeta a modules/<nombre> y completar.
 *
 * Este archivo lo importa el navegador (sidebar, formularios): solo datos y componentes
 * de UI. Nada de base de datos, nada de secretos, nada de `server-only`.
 */
const manifiesto: ManifiestoModulo = {
  // Igual al nombre de la carpeta, en snake_case.
  nombre: "mi_modulo",
  titulo: "Mi modulo",
  descripcion: "Que hace este modulo, en una frase.",
  version: "1.0.0",

  // Entradas del menu lateral. `ruta` es relativa a /m/<nombre>; vacia = principal.
  nav: [{ etiqueta: "Mi modulo", icono: Package, seccion: "Operaciones" }],

  // Campos del contacto que aporta el modulo (misma forma que config/cliente.ts).
  // Usar el nombre del modulo como prefijo de la clave para no chocar.
  campos: [
    // { clave: "mi_modulo_dato", etiqueta: "Dato", tipo: "texto", enTabla: false },
  ],
};

export default manifiesto;
