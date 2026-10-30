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

  /**
   * Datos de demostracion del rubro. Hasta 2.0.1 esto estaba escrito a mano dentro de
   * `src/lib/seed-demo.ts`, asi que adaptar el CRM a otro rubro obligaba a tocar el
   * nucleo. Ahora cada plantilla trae los suyos y el nucleo carga genericos.
   */
  demo: {
    valoresTexto: [
      "Providencia",
      "Las Condes",
      "Nunoa",
      "La Reina",
      "Vitacura",
      "Santiago Centro",
      "Maipu",
      "Colina",
    ],
    conversaciones: [
      [
        { dir: "in", body: "Hola! Vi una publicacion de ustedes y quiero mas informacion." },
        { dir: "out", origen: "agent", body: "Hola! Con gusto. Para orientarte mejor, que estas buscando y en que zona?" },
        { dir: "in", body: "Algo de 2 dormitorios, por Providencia o Nunoa, hasta 150 mil." },
        { dir: "out", origen: "agent", body: "Perfecto, tengo un par de opciones que calzan. Te las paso y si te interesa alguna coordinamos una visita." },
        { dir: "in", body: "Dale, mandame." },
      ],
      [
        { dir: "in", body: "Buenas, cuanto sale el arriendo de la oficina que publicaron?" },
        { dir: "out", origen: "agent", body: "Hola! La oficina de Apoquindo esta en USD 900 mensuales, 45 m2 habilitados. Te sirve ese tamano?" },
        { dir: "in", body: "Si, me gustaria verla esta semana." },
        { dir: "out", origen: "human", body: "Hola, soy del equipo. Te propongo jueves 11:00 o viernes 16:00, cual te acomoda?" },
      ],
      [
        { dir: "in", body: "Hola, estoy buscando casa con patio para mi familia." },
        { dir: "out", origen: "agent", body: "Que bueno! Cuantos dormitorios necesitan y en que zona les gustaria vivir?" },
        { dir: "in", body: "Minimo 3, idealmente La Reina o Penalolen." },
      ],
      [
        { dir: "in", body: "Me interesa invertir en algo chico para arrendar, que tienen?" },
        { dir: "out", origen: "agent", body: "Tengo un 1 dormitorio en Nunoa, edificio nuevo, en USD 95.000. Te paso el detalle?" },
        { dir: "in", body: "Si por favor, y si acepta credito." },
        { dir: "out", origen: "agent", body: "Es apto credito. Te dejo el link y, si quieres, agendamos una visita." },
      ],
      [
        { dir: "in", body: "Hola, necesito hablar con una persona, tengo dudas de financiamiento." },
        { dir: "out", origen: "agent", body: "Te paso con una persona del equipo que te va a ayudar con esto. En un momento te escribe." },
        { dir: "out", origen: "human", body: "Hola, soy Ana del equipo. Cuentame que dudas tienes y lo vemos juntos." },
      ],
      [
        { dir: "in", body: "Quiero arrendar una casa en Vitacura, 3 dormitorios." },
        { dir: "out", origen: "agent", body: "Tengo una casa de un piso con jardin en Vitacura por USD 2.400. Te gustaria visitarla?" },
        { dir: "in", body: "Si, el sabado en la manana puedo." },
      ],
    ],
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
