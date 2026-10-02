import { CalendarDays, MapPin } from "lucide-react";
import type { ManifiestoModulo } from "@/lib/modules/types";

/**
 * Modulo visitas: coordinacion de visitas a propiedades (o a cualquier lugar) con
 * agenda mensual. Lo usa la plantilla inmobiliaria; sirve para cualquier negocio que
 * agende encuentros presenciales.
 */
const manifiesto: ManifiestoModulo = {
  nombre: "visitas",
  titulo: "Visitas",
  descripcion: "Visitas coordinadas y en proceso, con calendario mensual y tool para que el agente las agende.",
  version: "1.0.0",
  nav: [
    { etiqueta: "Visitas", icono: MapPin, seccion: "Operaciones" },
    { ruta: "calendario", etiqueta: "Calendario", icono: CalendarDays, seccion: "Productividad" },
  ],
};

export default manifiesto;
