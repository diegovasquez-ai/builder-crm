# Builder CRM — guia para Claude Code

Builder CRM es el CRM que los miembros de **IA Builder Lab** entregan a sus clientes:
una bandeja unica de **WhatsApp, Instagram y Messenger** con un **agente de IA** que
califica leads, mueve el pipeline y deja la ficha al dia. Cada miembro clona este repo,
despliega **una instancia por cliente** (Coolify + Supabase) y la adapta con Claude
Code sin tocar el nucleo. Este archivo es lo primero que lees en cada sesion.

**Principio rector: agent first.** El nucleo es minimo y generico; todo lo del cliente
va en configuracion o en modulos, y lo hace Claude guiado por las skills de
`.claude/skills/`. La constitucion manda: [`specs/CONSTITUCION.md`](specs/CONSTITUCION.md).

## Stack y arquitectura

Next.js 16 (App Router) + React 19 + TypeScript strict · Tailwind 4 + shadcn/ui ·
Drizzle ORM sobre **Supabase Postgres** (RLS en todas las tablas) · **Supabase Auth**
(email + password; roles `admin` / `asesor` en `team_members`) · mensajeria por
**Zernio** (un webhook para los tres canales) · agente por **OpenRouter** (modelo por
`AGENT_MODEL`) · Web Push + PWA · Docker multi-stage para **Coolify** (migraciones al
arrancar, `/api/health`).

```
Cliente (WhatsApp/IG/Messenger) -> Zernio -> POST /api/webhooks/zernio
   -> src/lib/channels/webhook.ts (firma, idempotencia en webhook_events, after())
   -> conector.webhook.procesar -> ingest.ts (contacto, conversacion, mensaje, job)
   -> worker /api/agent/process -> src/lib/agent (prompt + CONTEXTO + tools)
   -> deliverMessage -> conector.enviar (Zernio | Meta | simulador)
```

| Carpeta | Que es |
|---|---|
| `src/app/` | Paginas y rutas de API del nucleo. `/m/[modulo]` y `/api/m/[modulo]` despachan a los modulos. |
| `src/lib/config/` | Lectura y validacion de `config/cliente.ts`; marca -> CSS vars; campos personalizados. |
| `src/lib/channels/` | `conector.ts` (interfaz), `conectores/` (zernio, meta-cloud parcial, simulador), `webhook.ts`, `deliver.ts`, `ingest.ts`. |
| `src/lib/agent/` | Loop, prompt generico, registro de tools (nucleo + modulos), config por canal. |
| `src/lib/modules/` | Tipos del contrato de modulo, registro generado, resolucion de rutas. |
| `src/lib/reportes.ts`, `seed-demo.ts`, `simulador.ts` | Reportes reales, datos demo, simulador. |
| `supabase/migrations/` | Migraciones del nucleo (base, RLS, primer admin). Las aplica `scripts/migrar.mjs`, y `scripts/local.mjs` las mismas sobre la base embebida. |
| `scripts/` | migrar, crear-admin, seed-demo, verificar-instancia, zernio:*, generar-registro-modulos, pwa-icons. |

## Zonas: que se toca y que no

| Zona | Carpetas | Regla |
|---|---|---|
| **NUCLEO (no se toca para un cliente)** | `src/`, `supabase/`, `scripts/`, `docker/`, `Dockerfile`, `docker-compose.yml`, `next.config.ts`, `package.json` | Solo cambia con una version nueva del repo original. Si una adaptacion necesita tocarlo, es una mejora generica: se propone al repo original, no se parchea en la instancia. |
| **ZONA DEL CLIENTE** | `config/cliente.ts`, `config/modulos.json`, `config/plantillas/`, `modules/<nombre>/`, `public/marca/`, `public/icons/`, `specs/<cliente>/`, `.env.local` (nunca al repo) | Aqui va TODO lo especifico: marca, pipeline, campos, prompt, modulos, assets, specs. |
| **Compartido** | `specs/CONSTITUCION.md`, `specs/_plantilla.md`, `specs/nucleo/`, `.claude/`, `docs/` | Documentacion y arnes. Se actualizan con el nucleo. |

Criterio de aceptacion: cambiar nombre, logo, colores, pipeline y campos de un cliente
**sin editar ningun archivo del nucleo**. `git status` despues de una adaptacion solo
muestra la zona del cliente.

## Flujo one-shot (de un prompt a una instancia funcionando)

Prompt tipico: *"Adapta Builder CRM para una inmobiliaria llamada Casa Sur, con modulo
de propiedades y agendamiento de visitas, y despliegalo en mi Coolify."*

| Paso | Que pasa | Skill |
|---|---|---|
| 1. Entender | Leer el brief ([`specs/_brief.md`](specs/_brief.md) es que preguntarle al cliente); maximo 3 preguntas si falta algo critico (dominio, credenciales, nicho). | `adaptar-a-cliente` |
| 2. Especificar | `specs/<cliente>/spec.md` desde `specs/_plantilla.md`. | `adaptar-a-cliente` |
| 3. Configurar | `config/cliente.ts` (desde una plantilla de `config/plantillas/` o desde cero), `config/modulos.json`, `public/marca/`, `npm run pwa:icons`. | `adaptar-a-cliente` |
| 4. Construir | Modulos nuevos en `modules/` que la spec requiera. | `crear-modulo` |
| 5. Desplegar | Proyecto Supabase, migraciones, primer admin, app en Coolify, variables, deploy. | `deploy-coolify` |
| 6. Conectar | WhatsApp / Instagram / Messenger via Zernio (puede ser despues de la demo). | `conectar-zernio` |
| 7. Probar | `scripts/verificar-instancia.mjs`: health, login, marca, pipeline, simulador -> agente -> etapa, modulos. Corregir hasta verde. | `probar-instancia` |
| 8. Entregar | URL, credenciales de la cuenta demo, resumen de lo construido y lo pendiente. | `adaptar-a-cliente` |

Otras skills: `nueva-plantilla-nicho` (convertir una adaptacion exitosa en plantilla
reutilizable), `actualizar-desde-original` (traer una version nueva del nucleo a una
instancia adaptada). Las skills `supabase`, `playwright-cli` y `memory-manager` son de
apoyo.

**Definicion de hecho**: `npm test && npm run typecheck && npm run lint && npm run build`
es el piso, y lo mismo corre el CI. Una instancia esta terminada cuando
`probar-instancia` pasa en verde contra la URL desplegada. No se delega la prueba al
miembro ni al cliente.

Los tests de `tests/` cubren los invariantes que **fallan en silencio**: la firma del
webhook, la ventana de 24 h, el filtro por rol, la validacion de `config/cliente.ts`, el
bloque de configuracion publica y las plantillas de correo. Corren sin base y sin red en
un segundo. Lo que necesita base o navegador se prueba con `verificar-instancia`.

## Convenciones

- **Idioma**: UI y comentarios en espanol sin acentos obligatorios (consistencia con
  el codigo existente); nombres de archivos y simbolos nuevos en espanol
  (`conector.ts`, `moverEtapa`), los heredados en ingles se dejan como estan.
- **Componentes** de ~300 lineas maximo; iconos de `lucide-react` (los de canal son
  SVG inline en `src/components/icons/channels.tsx`); forms con `react-hook-form` +
  `zod`; drag & drop con `@dnd-kit`; montos en **centavos** y `formatCurrency()` (moneda
  de la config); fechas con `date-fns`.
- **Rutas de API**: `requireMember()` / `requireAdmin()` de `src/lib/api-auth.ts` al
  inicio; acceso por contacto con `canAccessContactId`; lo ajeno responde **404**, no 403.
- **Version**: se sube con `npm version <nueva> --no-git-tag-version`, que actualiza
  `package.json` y `package-lock.json` a la vez. A mano se desincronizan.
- **Commits**: uno por cambio logico, en espanol, primera linea imperativa y
  concreta ("Agregar modulo pedidos", "Corregir ventana de 24h en Messenger"); sin
  backticks en el mensaje. Nunca `.env*`, `.mcp.json` ni datos reales.
- **Specs antes que codigo**: toda funcionalidad nueva nace en `specs/` (carril
  completo si toca datos o contratos; ligero si es config, modulo o UI).

## Lo que NO es obvio (leer antes de tocar)

- **`deliverMessage` es el unico camino de salida.** El agente, el chat y las
  plantillas pasan por ahi; el conector se elige por `conversations.provider`.
- **La conversacion no es el contacto.** Una persona puede tener hilo de WhatsApp y de
  Instagram; la ruta es `/conversations/[conversationId]`.
- **Idempotencia de mensajes**: indice unico parcial sobre `messages.external_id`
  (a proposito NO compuesto con provider). Los webhooks reclaman el evento en
  `webhook_events` antes de responder 2xx; el barrido (`GET` con
  `AGENT_WORKER_SECRET`) reprocesa lo colgado.
- **Zernio exige 2xx en 5 s**: la ruta del webhook importa lo minimo y procesa en
  `after()`; lo pesado entra por `import()` dinamico. 10 fallos seguidos y Zernio apaga
  la suscripcion (`npm run zernio:webhook` la reactiva).
- **`ZERNIO_WEBHOOK_SECRET` debe ser identico** en la instancia y en la suscripcion
  de Zernio; si no, 401 silencioso y "no entran mensajes".
- **Un agente por canal** (`agent_configs`): Instagram y Messenger arrancan apagados.
  Cascada del prompt: canal -> global (Ajustes) -> `config.agente.prompt` -> default.
  El agente agrega CONTEXTO (contacto, etapa, pipeline, datos a averiguar) y EQUIPO.
- **La ventana de 24 h la decide el servidor** (`conversations.last_inbound_at`):
  IG/Messenger fuera de ventana van con `HUMAN_AGENT`; WhatsApp solo con plantilla.
- **Pausa del agente**: por conversacion (`PATCH /api/conversations/:id/agente`);
  el contacto tiene ademas un kill-switch global. `derivar_asesor` pausa solo el hilo.
- **El proceso corre en UTC; la zona horaria sale de la configuracion.** El contenedor no
  define `TZ` a proposito: una imagen compartida por muchas instancias no puede traer la
  zona horneada. Por eso `config.zonaHoraria` (IANA, default `UTC`) es la que manda, y
  todo lo que resuelva un dia o una hora tiene que pasarsela a `Intl`: el prompt del
  agente (`{{fecha}}`) y `formatDate` / `formatRelativeDate` ya lo hacen. Si se omite, el
  sintoma no es un error sino un agente que nombra el dia equivocado de noche, y en la
  maquina de un miembro chileno no se reproduce. Los tests corren tambien con `TZ=UTC`
  por eso. Ver `specs/nucleo/11-zona-horaria.md`.
- **Nunca pasar un `Date` dentro de `db.execute(sql\`...\`)`.** Ese camino llega al
  driver por `unsafe()`, que no serializa fechas, y la consulta muere con
  `ERR_INVALID_ARG_TYPE` antes de salir. En SQL crudo las fechas van como texto ISO con
  cast (`${fecha.toISOString()}::timestamptz`); con el constructor de Drizzle se pasa el
  `Date` tal cual, porque ahi si se conoce el tipo de la columna.
- **El cliente de base es perezoso.** `src/db/index.ts` exporta un proxy que arma la
  conexion en el primer uso. `next build` importa cada route handler, y el build NO
  debe pedir `DATABASE_URL`: en el Dockerfile solo las `NEXT_PUBLIC_*` son build args,
  porque la base de cada instancia se conoce al desplegar. Si un modulo consulta la
  base al importarse, el build se rompe de nuevo: las consultas van dentro de la
  funcion. El CI corre `build` sin `DATABASE_URL` justamente para detectarlo.
- **RLS protege la API publica de Supabase, no a Drizzle**: la app entra como
  `postgres` (bypass). `anon` no tiene privilegios; `authenticated` solo lectura
  segun `team_members`. Toda tabla nueva (tambien de modulos) con RLS; el runner lo
  fuerza si falta.
- **Migraciones**: `supabase/migrations/` + `modules/<activo>/migrations/`, en orden,
  registradas en `_migraciones`. Hasta 1.0.0 `0000_base.sql` se regenera desde el
  schema; desde 1.0.0 solo se agregan archivos. Corren solas al arrancar el contenedor.
- **Registro de modulos generado**: `config/modulos.json` ->
  `src/lib/modules/*.generated.ts` (lo escribe `next.config.ts` y `npm run
  typecheck`). Un modulo inactivo no entra al bundle; sus rutas dan 404. Esos dos
  archivos **no se versionan**: si se versionaran, activar un modulo dejaria cambios
  dentro de `src/` y chocarian en cada actualizacion del nucleo.
- **Primera cuenta**: el disparador `on_auth_user_created` da de alta en
  `team_members` SOLO a la primera cuenta de la instancia, como admin. A partir de ahi
  nadie entra solo: un usuario de Auth sin fila en `team_members` cae en `/sin-acceso`.
  Esto no es cosmetico, es la unica puerta: el endpoint `/auth/v1/signup` del proveedor
  es publico y la pagina `/signup` del CRM no puede impedir que lo llamen a mano. Las
  altas reales van por Ajustes -> Equipo, que inserta la fila con su rol, o por
  `npm run admin:crear`.
- **Los correos de acceso los manda el proveedor, no el CRM.** Invitaciones y "olvide mi
  contrasena" salen de GoTrue con su SMTP; el CRM solo declara la capacidad con
  `AUTH_ENVIA_CORREOS=true` y ofrece los botones. Es un interruptor manual porque GoTrue
  sin SMTP no falla: se traga el correo y responde 200, y la UI diria "enviado" sobre
  nada. Los tres caminos aterrizan en `/auth/definir-clave`, que lee la sesion del
  fragmento de la URL (por eso corre en el navegador) y limpia la barra. Las plantillas
  las sirve el propio CRM en `/correo/*.html`, publicas porque las descarga GoTrue.
  Ver `docs/CORREO.md`.
- **Lo que el navegador necesita se sirve en EJECUCION, no en el build.** Next hornea
  las `NEXT_PUBLIC_*` al compilar, y en una imagen compartida por muchas instancias eso
  no sirve: el layout escribe la URL de Supabase, su clave anonima y las capacidades en
  un bloque JSON (`src/lib/config-publica.ts`) y el navegador lo lee de ahi. Ningun
  componente cliente lee `process.env` directo, y lo que falte (la clave VAPID) sale de
  una ruta de API. Consecuencia practica: en Coolify TODAS las variables van en runtime y
  no hay que marcar ninguna como build. El `Dockerfile` las sigue aceptando como build
  args para plataformas que las hornean. Nada de secretos en el codigo ni en `.mcp.json`
  (solo `.mcp.json.example`).
- **El modo local apaga la autenticacion entera.** `npm run local` levanta un Postgres
  embebido (`.local/db`) y entra sin sesion: quien abre la URL es admin. Por eso tiene
  dos candados y el segundo es el que importa: `MODO_LOCAL=true` (lo pone solo ese
  script) **y** `NODE_ENV` distinto de `production`, que no depende de configuracion y
  hace imposible encenderlo en una imagen desplegada. Si se encendiera por error no
  fallaria nada: el unico sintoma seria que cualquiera entra. Ver `src/lib/modo-local.ts`
  y `specs/nucleo/10-modo-local.md`.
- **`db.execute` devuelve cosas distintas segun el driver**: el array de filas con
  `postgres`, `{ rows }` con el embebido. El proxy de `src/db/index.ts` lo normaliza en
  modo local porque media docena de lugares hacen `resultado[0]`; sin eso los reportes
  salen en cero sin un solo error.
- **Datos demo** por `POST /api/seed/demo` (admin o `AGENT_WORKER_SECRET`): usan el
  conector `simulador` para que la demo responda; los reportes solo excluyen a los
  contactos creados desde `/simulador`.
- **En Vercel** los barridos van por `vercel.json` + `.github/workflows/sweepers.yml`
  (Hobby no permite crons frecuentes); en Coolify corren dentro del proceso
  (`src/lib/barridos.ts`).

## Comandos

```bash
npm run local               # probarlo sin cuentas: Postgres embebido + demo, sin login
npm run dev                 # contra tu Supabase (http://localhost:3000)
npm test                    # invariantes del nucleo (vitest, sin base ni red)
npm run typecheck && npm run lint && npm run build
npm run db:migrar           # aplica migraciones pendientes (nucleo + modulos activos)
npm run db:status           # que esta aplicado y que falta
npm run admin:crear -- --email a@b.com --password 'xxxxxxxx'
npm run seed                # datos de demostracion (via POST /api/seed/demo)
node scripts/verificar-instancia.mjs --url https://crm.cliente.com --email ... --password ...
npm run zernio:setup -- --sync | npm run zernio:webhook -- --url https://... | npm run zernio:whatsapp
npm run pwa:icons           # iconos desde public/marca/icono.png
```

Variables: ver `.env.example` (cada una explicada). MCP: `.mcp.json.example` y
[`docs/MCP.md`](docs/MCP.md). Memoria del proyecto: `.claude/memory/` (skill
`memory-manager`).
