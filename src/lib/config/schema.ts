import { z } from "zod";

/**
 * Esquema de la configuracion por cliente (`config/cliente.ts`).
 *
 * Este archivo NO importa nada server-only a proposito: los componentes cliente
 * (sidebar, formularios) leen la marca y los campos directamente. Aqui no va ninguna
 * credencial; eso es entorno (.env), no configuracion.
 */

const hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Color en formato #rrggbb");

const clave = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "Clave en snake_case, empieza con letra (ej. tipo_operacion)");

/**
 * Zona horaria IANA. Se valida contra el propio entorno (`Intl` existe igual en Node y
 * en el navegador) porque una zona mal escrita no falla sola: `Intl` la rechaza al
 * formatear y el error aparece lejos de aqui, o peor, alguien la captura y la fecha sale
 * en UTC sin que nadie se entere.
 */
const zonaIana = z
  .string()
  .min(1)
  .superRefine((valor, ctx) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: valor });
    } catch {
      ctx.addIssue({
        code: "custom",
        message: `zona horaria desconocida: "${valor}". Va un identificador IANA, como America/Santiago, America/Mexico_City o Europe/Madrid`,
      });
    }
  });

export const esquemaMarca = z.object({
  /** Nombre completo: pestana, login, sidebar, X-Title del agente. */
  nombre: z.string().min(1).max(60),
  /** Nombre corto para el icono de la PWA y las notificaciones (max 12). */
  nombreCorto: z.string().min(1).max(12),
  /** Una frase: aparece en el login y en la descripcion de la PWA. */
  descripcion: z.string().max(200).default("CRM multicanal con agente de IA."),
  /** Rutas publicas (dentro de public/marca/). */
  logo: z.string().min(1).default("/marca/logo.png"),
  icono: z.string().min(1).default("/marca/icono.png"),
  /** Color de los botones y acciones primarias. */
  colorPrimario: hex.default("#2E4A47"),
  /** Color de fondo del sidebar y de la barra del telefono (theme_color). */
  colorSidebar: hex.default("#0F1419"),
});

export const esquemaEtapa = z.object({
  clave: clave,
  nombre: z.string().min(1).max(60),
  color: hex.default("#64748b"),
  ganada: z.boolean().default(false),
  perdida: z.boolean().default(false),
});

export const esquemaPipeline = z.object({
  nombre: z.string().min(1).max(60).default("Ventas"),
  etapas: z
    .array(esquemaEtapa)
    .min(2, "Un pipeline necesita al menos dos etapas")
    .refine(
      (e) => new Set(e.map((x) => x.clave)).size === e.length,
      "Hay etapas con la misma clave"
    ),
});

export const TIPOS_CAMPO = ["texto", "numero", "seleccion", "booleano", "fecha"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const esquemaCampo = z
  .object({
    clave: clave,
    etiqueta: z.string().min(1).max(60),
    tipo: z.enum(TIPOS_CAMPO),
    /** Solo para tipo `seleccion`. */
    opciones: z.array(z.string().min(1)).optional(),
    requerido: z.boolean().default(false),
    /** Mostrar como columna en la tabla de contactos. */
    enTabla: z.boolean().default(false),
    /** Texto de ayuda en el formulario. */
    ayuda: z.string().max(200).optional(),
    /**
     * Si el agente de IA debe averiguar este dato en la conversacion. La descripcion
     * le dice al modelo que preguntar ("presupuesto maximo en dolares").
     */
    agente: z
      .object({
        calificar: z.boolean().default(true),
        descripcion: z.string().max(300).optional(),
      })
      .optional(),
  })
  .refine(
    (c) => c.tipo !== "seleccion" || (c.opciones && c.opciones.length > 0),
    "Un campo de tipo seleccion necesita opciones"
  );

export const esquemaAgente = z.object({
  /** Como se presenta el agente en la conversacion. */
  nombre: z.string().max(40).default("Asistente"),
  /** Prompt base. Si falta, se usa el default del nucleo (src/lib/agent/prompt.ts). */
  prompt: z.string().optional(),
  /** Modelo de OpenRouter. AGENT_MODEL (entorno) manda sobre este valor. */
  modelo: z.string().optional(),
  /** Lo que se le dice al cliente cuando el agente deriva a una persona. */
  mensajeDerivacion: z
    .string()
    .min(1)
    .max(500)
    .default("Te paso con una persona del equipo que te va a ayudar con esto. Un momento."),
});

export const esquemaModulosNucleo = z.object({
  automatizaciones: z.boolean().default(true),
  actividades: z.boolean().default(true),
  plantillas: z.boolean().default(true),
  push: z.boolean().default(true),
  reportes: z.boolean().default(true),
  /** Simulador de conversaciones (solo admin). */
  simulador: z.boolean().default(true),
});

export const esquemaConfig = z.object({
  marca: esquemaMarca,
  idioma: z.enum(["es", "en"]).default("es"),
  /** Codigo ISO 4217 para formatear montos. */
  moneda: z.string().length(3).default("USD"),
  /**
   * Zona horaria del negocio: con que zona se resuelve el dia y la hora, en pantalla y
   * en el prompt del agente. El proceso corre en UTC a proposito (una imagen compartida
   * por muchas instancias no puede traer la zona horneada), asi que sin esto el agente
   * nombra el dia equivocado de noche. Ver `specs/nucleo/11-zona-horaria.md`.
   *
   * El default es UTC para no mover las fechas de una instancia ya desplegada que
   * actualice el nucleo sin tocar su configuracion.
   */
  zonaHoraria: zonaIana.default("UTC"),
  roles: z
    .object({
      /** Como se llama al rol `asesor` en pantalla (Asesor, Agente, Vendedor...). */
      etiquetaAsesor: z.string().min(1).max(30).default("Asesor"),
    })
    .default({ etiquetaAsesor: "Asesor" }),
  pipeline: esquemaPipeline,
  contacto: z
    .object({
      campos: z
        .array(esquemaCampo)
        .default([])
        .refine(
          (c) => new Set(c.map((x) => x.clave)).size === c.length,
          "Hay campos con la misma clave"
        ),
    })
    .default({ campos: [] }),
  agente: esquemaAgente.default({
    nombre: "Asistente",
    mensajeDerivacion: "Te paso con una persona del equipo que te va a ayudar con esto. Un momento.",
  }),
  /** Funciones del nucleo apagables + modulos de `modules/` por nombre de carpeta. */
  modulos: z
    .object({
      nucleo: esquemaModulosNucleo.default({
        automatizaciones: true,
        actividades: true,
        plantillas: true,
        push: true,
        reportes: true,
        simulador: true,
      }),
      /** Nombres de carpetas dentro de modules/ que estan activas. */
      activos: z.array(clave).default([]),
    })
    .default({
      nucleo: {
        automatizaciones: true,
        actividades: true,
        plantillas: true,
        push: true,
        reportes: true,
        simulador: true,
      },
      activos: [],
    }),
});

export type ConfigCliente = z.infer<typeof esquemaConfig>;
export type ConfigClienteEntrada = z.input<typeof esquemaConfig>;
export type Marca = z.infer<typeof esquemaMarca>;
export type EtapaConfig = z.infer<typeof esquemaEtapa>;
export type CampoConfig = z.infer<typeof esquemaCampo>;

/**
 * Se usa en config/cliente.ts. No valida aqui (lo hace `src/lib/config` una sola vez)
 * para que un error de configuracion no rompa el import, sino que se reporte con
 * contexto al arrancar y en /api/health.
 */
export function definirConfig(entrada: ConfigClienteEntrada): ConfigClienteEntrada {
  return entrada;
}
