import { definirConfig } from "@/lib/config/schema";
import modulos from "./modulos.json";

/**
 * CONFIGURACION DEL CLIENTE — zona del cliente, no del nucleo.
 *
 * Todo lo que distingue a esta instancia vive aqui: marca, pipeline, campos del
 * contacto, agente y modulos activos. Cambiar este archivo (y los assets de
 * public/marca/) es la unica forma prevista de personalizar el CRM; el nucleo (src/)
 * no se toca. El esquema completo esta en src/lib/config/schema.ts.
 *
 * Para una plantilla de nicho: importar la plantilla y extenderla, por ejemplo
 *   import { plantillaInmobiliaria } from "./plantillas/inmobiliaria";
 *   export default definirConfig({ ...plantillaInmobiliaria, marca: { ... } });
 */
export default definirConfig({
  marca: {
    nombre: "Builder CRM",
    nombreCorto: "Builder",
    descripcion: "El CRM multicanal con agente de IA de la comunidad IA Builder Lab.",
    logo: "/marca/logo.png",
    icono: "/marca/icono.png",
    // Medidos del logo de IA Builder Lab: el cian del anillo sobre el carbon del fondo.
    colorPrimario: "#3CF5F5",
    colorSidebar: "#171E21",
  },

  idioma: "es",
  moneda: "USD",
  // La del negocio del cliente, no la tuya: decide el dia que el agente le nombra a
  // quien escribe de noche. America/Mexico_City, America/Bogota, Europe/Madrid...
  zonaHoraria: "America/Santiago",

  roles: {
    etiquetaAsesor: "Asesor",
  },

  pipeline: {
    nombre: "Ventas",
    etapas: [
      { clave: "nuevo", nombre: "Nuevo lead", color: "#64748b" },
      { clave: "contactado", nombre: "Contactado", color: "#2563eb" },
      { clave: "calificado", nombre: "Calificado", color: "#8b5cf6" },
      { clave: "propuesta", nombre: "Propuesta", color: "#f59e0b" },
      { clave: "negociacion", nombre: "Negociacion", color: "#ea580c" },
      { clave: "ganado", nombre: "Cerrado ganado", color: "#16a34a", ganada: true },
      { clave: "perdido", nombre: "Cerrado perdido", color: "#dc2626", perdida: true },
    ],
  },

  contacto: {
    // Campos propios del negocio. Ejemplo:
    // { clave: "presupuesto", etiqueta: "Presupuesto", tipo: "numero", enTabla: true,
    //   agente: { descripcion: "presupuesto maximo del cliente" } },
    campos: [],
  },

  agente: {
    nombre: "Asistente",
  },

  modulos: {
    nucleo: {
      automatizaciones: true,
      actividades: true,
      plantillas: true,
      push: true,
      reportes: true,
      simulador: true,
    },
    // Carpetas de modules/ activas en esta instancia: se editan en config/modulos.json
    // (lo leen tambien el runner de migraciones y el generador del registro).
    activos: modulos.activos,
  },
});
