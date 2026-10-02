# Cambios

Que trae cada version de Builder CRM y que hacer para actualizar. SemVer segun lo que
le importa a quien opera una instancia (ver "Versiones" en el [README](README.md)):
mayor = pasos manuales, menor = funciones nuevas, parche = arreglos.

## 1.0.0 — 2026-10-02

Primera version para la comunidad IA Builder Lab. Nace de un CRM construido para un
cliente inmobiliario (Next.js 16 + Supabase + Zernio) y lo convierte en una plantilla
con nucleo minimo, zona del cliente y arnes de Claude Code.

### Actualizar desde…

No hay version anterior compatible: esta es la base. Las instancias del CRM de origen no
se actualizan por merge; se migran creando una instancia nueva y cargando los datos.

### Nucleo

- **Base desplegable**: migraciones canonicas en `supabase/migrations/` (base, RLS,
  primer admin) aplicadas por `scripts/migrar.mjs` (tabla `_migraciones`, transaccion
  por archivo, reintentos, RLS forzado); `src/lib/env.ts`; `/api/health` con version y
  commit; Dockerfile multi-stage con migraciones al arrancar; `docker-compose.yml`
  solo app; barridos dentro del proceso fuera de Vercel.
- **Seguridad**: RLS en todas las tablas, `anon` sin privilegios, politicas de lectura
  por rol; `requireMember` en toda ruta de datos y chequeo de propietario por
  contacto; registro publico abierto solo para la primera cuenta (admin);
  `scripts/crear-admin.mjs`.
- **Configuracion por cliente**: `config/cliente.ts` (marca, idioma, moneda, roles,
  pipeline, campos del contacto, agente, modulos) validada con zod; marca aplicada en
  SSR (CSS variables, manifest de la PWA, titulo); pipeline sincronizado por clave al
  arrancar; `contacts.custom_fields` en formulario, ficha, tabla y chat.
- **Modulos**: `modules/<nombre>/` con manifiesto, servidor (paginas, API, tools,
  seed) y migraciones; `config/modulos.json`; registro generado con imports
  estaticos; catch-all `/m/<modulo>` y `/api/m/<modulo>`; menu construido desde la
  config. Incluye `_plantilla` y `ejemplo`.
- **Conectores**: interfaz `Conector` (enviar, webhook, estado); Zernio completo,
  Meta Cloud API parcial y documentado, simulador; mecanica generica de webhooks;
  webhook de leads en `/api/webhooks/leads`.
- **Agente**: tools genericas (`mover_etapa`, `actualizar_contacto`,
  `registrar_actividad`, `resumen_lead`, `derivar_asesor`, `asignar_asesor`) mas las
  de los modulos; prompt generico con CONTEXTO y EQUIPO; cascada canal -> global ->
  config -> default; pausa por conversacion; responde solo por `deliverMessage`;
  `contacts.ai_summary`.
- **Simulador** (`/simulador`, solo admin): chatear con el agente sin canal conectado
  y ver lo que cambia en el CRM; base de la autoverificacion.
- **Reportes reales** por 7/30/90 dias y dashboard sin numeros inventados;
  `messages.origin`.
- **Datos demo** por `POST /api/seed/demo`, `npm run seed` y boton del inicio.

### Plantillas y modulos

- `config/plantillas/inmobiliaria.ts` (7 etapas, 5 campos, prompt calificador).
- `modules/propiedades` (catalogo, busqueda semantica o por filtros, Tokko opcional).
- `modules/visitas` (visitas, calendario, tool `agendar_visita`).

### Arnes

- `CLAUDE.md`, `specs/CONSTITUCION.md`, `specs/_plantilla.md`, `specs/nucleo/*`,
  `specs/inmobiliaria/spec.md`.
- Skills: `adaptar-a-cliente`, `crear-modulo`, `nueva-plantilla-nicho`,
  `deploy-coolify`, `conectar-zernio`, `probar-instancia`, `actualizar-desde-original`.
- `.mcp.json.example` + `docs/MCP.md`; `scripts/verificar-instancia.mjs`; CI.

### Quitado respecto del CRM de origen

Clasificacion con Anthropic, digest por Resend, servidor MCP sobre SQLite, slash
commands de auto-crm, experimento GoHighLevel, scripts de operacion de un cliente,
datos del cliente en el prompt, maqueta de reportes.
