import type { ConfigClienteEntrada } from "@/lib/config/schema";

/**
 * PLANTILLA DE NICHO: inmobiliaria.
 *
 * Pipeline, campos del contacto y prompt del agente para una inmobiliaria que vende y
 * arrienda. Se usa desde config/cliente.ts:
 *
 *   import { plantillaInmobiliaria } from "./plantillas/inmobiliaria";
 *   export default definirConfig({
 *     ...plantillaInmobiliaria,
 *     marca: { ...plantillaInmobiliaria.marca, nombre: "Casa Sur", ... },
 *   });
 *
 * y activando los modulos en config/modulos.json: { "activos": ["propiedades", "visitas"] }.
 * Luego: npm run db:migrar (crea las tablas de los modulos).
 */
export const plantillaInmobiliaria: ConfigClienteEntrada = {
  marca: {
    nombre: "Inmobiliaria Demo",
    nombreCorto: "Inmo",
    descripcion: "CRM inmobiliario con agente de IA en WhatsApp, Instagram y Messenger.",
    logo: "/marca/logo.png",
    icono: "/marca/icono.png",
    colorPrimario: "#1E6F5C",
    colorSidebar: "#0F1A17",
  },

  idioma: "es",
  moneda: "USD",
  zonaHoraria: "America/Santiago",

  roles: { etiquetaAsesor: "Asesor" },

  pipeline: {
    nombre: "Ventas y arriendos",
    etapas: [
      { clave: "nuevo", nombre: "Nuevo lead", color: "#64748b" },
      { clave: "calificado", nombre: "Calificado", color: "#2563eb" },
      { clave: "visita_agendada", nombre: "Visita agendada", color: "#8b5cf6" },
      { clave: "visita_realizada", nombre: "Visita realizada", color: "#0ea5e9" },
      { clave: "negociacion", nombre: "Negociacion", color: "#f59e0b" },
      { clave: "ganado", nombre: "Cerrado ganado", color: "#16a34a", ganada: true },
      { clave: "perdido", nombre: "Cerrado perdido", color: "#dc2626", perdida: true },
    ],
  },

  contacto: {
    campos: [
      {
        clave: "tipo_operacion",
        etiqueta: "Tipo de operacion",
        tipo: "seleccion",
        opciones: ["Compra", "Arriendo"],
        enTabla: true,
        agente: { calificar: true, descripcion: "si quiere comprar o arrendar" },
      },
      {
        clave: "tipo_propiedad",
        etiqueta: "Tipo de propiedad",
        tipo: "seleccion",
        opciones: ["Departamento", "Casa", "Oficina", "Local", "Terreno"],
        enTabla: true,
        agente: { calificar: true, descripcion: "que tipo de propiedad busca" },
      },
      {
        clave: "zona",
        etiqueta: "Zona",
        tipo: "texto",
        enTabla: true,
        agente: { calificar: true, descripcion: "barrio, comuna o zona donde busca" },
      },
      {
        clave: "presupuesto",
        etiqueta: "Presupuesto",
        tipo: "numero",
        enTabla: true,
        agente: { calificar: true, descripcion: "presupuesto maximo (numero, en la moneda que mencione)" },
      },
      {
        clave: "dormitorios",
        etiqueta: "Dormitorios",
        tipo: "numero",
        agente: { calificar: true, descripcion: "cantidad minima de dormitorios" },
      },
    ],
  },

  agente: {
    nombre: "Asistente de la inmobiliaria",
    mensajeDerivacion: "Te paso con una persona del equipo que te va a ayudar con esto. En un momento te escribe.",
    prompt: `# ROL
Sos {{agente}}, parte del equipo de {{negocio}}. Atendes por {{canal}} a personas que buscan comprar o arrendar una propiedad. Tu objetivo es entender que buscan, mostrarles opciones del catalogo cuando corresponde y llevarlas a una visita.

# COMO TRABAJAS
- Respondes breve y natural (1 a 3 parrafos cortos), en el idioma del cliente. No decis que sos una IA ni hablas de herramientas.
- Calificas con naturalidad, de a una pregunta por vez: la seccion DATOS A AVERIGUAR dice que falta saber. Cada dato que el cliente da lo guardas con actualizar_contacto antes de responder.
- Cuando el cliente describe lo que busca (zona, presupuesto, dormitorios, tipo), usas buscar_propiedades y le presentas 2 o 3 opciones con precio, dormitorios, m2, zona y link si existe. Nunca inventes propiedades ni precios: solo lo que devuelve la herramienta.
- Si pregunta por una propiedad concreta o pasa un link, usas buscar_info_propiedades.
- Cuando ya sabes operacion, tipo, zona y presupuesto, moves la operacion a "calificado" con mover_etapa.
- Si muestra interes en visitar, usas agendar_visita (una persona confirma fecha y hora) y moves la operacion a "visita_agendada".
- Si pide hablar con una persona, pregunta algo que no esta en el catalogo (condiciones, documentacion, financiamiento especifico) o una herramienta falla, usas derivar_asesor.
- Al final de una conversacion util dejas un resumen_lead con que busca, presupuesto, zona y proximo paso.

# IMPORTANTE
- La fecha de hoy es {{fecha}}.
- Tus respuestas se envian directamente por {{canal}}.
- Despues de usar una herramienta, integras la informacion en tu respuesta; nunca copias el JSON.`,
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
    // Recordatorio: la lista real vive en config/modulos.json.
    activos: ["propiedades", "visitas"],
  },
};
