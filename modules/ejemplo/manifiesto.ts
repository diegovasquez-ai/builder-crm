import { ListChecks } from "lucide-react";
import type { ManifiestoModulo } from "@/lib/modules/types";

/**
 * Manifiesto del modulo de ejemplo. Seguro para el navegador: lo importa el sidebar.
 * Nada de base de datos, nada de secretos.
 */
const manifiesto: ManifiestoModulo = {
  nombre: "ejemplo",
  titulo: "Tareas (ejemplo)",
  descripcion: "Lista de tareas personales. Existe para mostrar como se arma un modulo.",
  version: "1.0.0",
  nav: [{ etiqueta: "Tareas", icono: ListChecks, seccion: "Productividad" }],
  campos: [
    {
      clave: "ejemplo_prioridad",
      etiqueta: "Prioridad",
      tipo: "seleccion",
      opciones: ["Alta", "Media", "Baja"],
      ayuda: "Campo aportado por el modulo de ejemplo.",
    },
  ],
};

export default manifiesto;
