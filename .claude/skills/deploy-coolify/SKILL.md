---
name: deploy-coolify
description: |
  Despliega una instancia nueva de Builder CRM de principio a fin: base y Auth (Supabase
  cloud o autoalojados en el mismo Coolify), migraciones, primer admin, aplicacion en
  Coolify (Dockerfile) con sus variables, deploy, health check y datos demo. Activar
  cuando el usuario dice: despliega, deploy, subilo a Coolify, levanta la instancia,
  ponlo en produccion, crea el proyecto de Supabase.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Desplegar en Coolify

> Instancia a desplegar: $ARGUMENTS

Resultado: `https://<dominio>/api/health` responde `{ "ok": true, ... }`, se puede
iniciar sesion con la cuenta admin creada, y la demo esta cargada.

## 0. Lo que hace falta (pedirlo junto, una sola vez)

| Credencial | Donde se obtiene | Para que |
|---|---|---|
| **Dominio** con registro A al VPS | DNS del cliente | `APP_BASE_URL` y el dominio de la app |
| **Coolify** URL + API token (scope de escritura) | Coolify -> Keys & Tokens -> API tokens | crear la app, variables y deploy |
| **Base y Auth**: o un Personal Access Token de Supabase cloud, o nada (se autoalojan en el mismo Coolify) | supabase.com/dashboard/account/tokens, o el propio Coolify | ver el paso 1: hay que elegir antes de empezar |
| **OpenRouter** API key (opcional) | openrouter.ai -> Keys | el agente |
| **Zernio** (opcional, despues) | zernio.com -> Settings -> API Keys | canales |

Genera tu mismo los secretos que no vienen de un proveedor:
`openssl rand -hex 32` para `AGENT_WORKER_SECRET` y `LEADS_WEBHOOK_SECRET`,
`npx web-push generate-vapid-keys` para las VAPID. La contrasena del admin demo:
`openssl rand -base64 12`.

Nunca pegues secretos en el chat de vuelta, en el repo ni en `.mcp.json`.

## 1. Base y Auth: dos caminos, hay que elegir antes de empezar

El CRM usa Supabase para **dos cosas separadas**: Postgres (los datos) y GoTrue (quien
inicia sesion). No usa nada mas de Supabase. Por eso hay dos caminos validos, y el
primer paso es preguntarle al miembro cual quiere.

### A) Supabase cloud (un proyecto por cliente)

Mas rapido de levantar y con respaldos y panel incluidos. El plan gratuito alcanza, pero
**pausa los proyectos inactivos**, y un CRM de un cliente que se pausa es una llamada a
las 9 de la manana.

Con el MCP de Supabase en **modo cuenta** (sin `project_ref`): `list_organizations`,
`get_cost`/`confirm_cost`, `create_project` (region cercana al cliente, contrasena de
base generada). Espera a que el proyecto este activo. Si el miembro ya tiene un
proyecto, usa ese.

Obtener: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(`get_publishable_keys` / `get_project_url`), `SUPABASE_SERVICE_ROLE_KEY` (dashboard
-> Settings -> API; no lo expone el MCP por diseno: pedirlo), `DATABASE_URL` (Connect
-> Transaction pooler, puerto 6543) y `DIRECT_URL` (Session/direct, 5432, para
migraciones).

### B) Autoalojado en el mismo Coolify (Postgres + GoTrue)

Todo en el VPS del miembro: sin cuenta de Supabase, sin pausas y sin costo por cliente.
**Es el camino de la instancia de demostracion de IA Builder Lab.** A cambio, los
respaldos y las actualizaciones son suyos.

Guia completa, con las variables de GoTrue y lo que se rompe si se saltea un paso:
[`docs/SUPABASE-EN-VPS.md`](../../../docs/SUPABASE-EN-VPS.md). El orden importa y no es
obvio:

1. Base Postgres gestionada en Coolify (imagen `pgvector/pgvector:pg16` si se va a usar
   el modulo propiedades).
2. `npm run claves:supabase` genera el secreto JWT y las claves anonima y de servicio
   coherentes entre si. **No van a ningun repo.**
3. `npm run auth:preparar` crea en esa base lo que Supabase trae de fabrica y un
   Postgres pelado no: los roles `anon` / `authenticated` / `service_role`, el esquema
   `auth` con su dueno `supabase_auth_admin` y las funciones `auth.uid()` y companhia.
   Va **antes** de arrancar GoTrue, que espera encontrar ese rol.
4. GoTrue como aplicacion en Coolify, con su dominio. Al arrancar crea `auth.users` con
   sus propias migraciones.
5. Recien ahi `npm run db:migrar`, porque la ultima migracion pone un disparador sobre
   `auth.users`.

`NEXT_PUBLIC_SUPABASE_URL` es el dominio de GoTrue **incluyendo `/auth/v1`**, para que el
proxy recorte el prefijo.

## 2. Migraciones y primer admin (desde la maquina del miembro)

```bash
DATABASE_URL='<pooler>' DIRECT_URL='<directo>' npm run db:migrar
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
  npm run admin:crear -- --email admin@<cliente>.com --password '<generada>' --nombre "Admin"
```

Alternativa: `apply_migration` del MCP con el contenido de cada archivo de
`supabase/migrations/` y `modules/<activo>/migrations/`, en orden (y registrar en
`_migraciones` para que el runner no los repita). Verifica con
`get_advisors(security)`: no debe haber tablas sin RLS.

## 3. Coolify

Dos caminos: el **MCP** de Coolify si esta configurado (ver `docs/MCP.md`; el oficial
de Coolify v4 es de solo lectura) o la **REST API** con `curl`
(`COOLIFY_URL`, `COOLIFY_TOKEN`; verificar rutas contra la version instalada en
`<COOLIFY_URL>/docs/api`):

1. **Proyecto y servidor**: `GET /api/v1/projects`, `GET /api/v1/servers` -> uuids.
2. **Aplicacion desde repositorio** (el repo del cliente, publico o con deploy key):
   `POST /api/v1/applications/public` con `project_uuid`, `server_uuid`,
   `environment_name` (production), `git_repository`, `git_branch` (main),
   `build_pack: "dockerfile"`, `ports_exposes: "3000"`, `domains: "https://<dominio>"`,
   `instant_deploy: false`.
3. **Variables** (`POST /api/v1/applications/<uuid>/envs/bulk`): **todas en runtime, sin
   excepcion**. Desde 1.2.2 el servidor le pasa al navegador la configuracion publica en
   tiempo de ejecucion (`src/lib/config-publica.ts`), asi que ninguna `NEXT_PUBLIC_*`
   necesita hornearse en el build. No intentes marcarlas como de build: la API de
   Coolify 4.3 **rechaza el campo `is_build_time`** y solo se puede hacer desde la
   interfaz.

   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `DATABASE_URL`, `DIRECT_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, `AGENT_WORKER_SECRET`,
   `LEADS_WEBHOOK_SECRET`, `OPENROUTER_API_KEY`, `AGENT_MODEL` (opcional),
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, y las de Zernio/S3 si ya existen. Lista
   completa y explicada en `.env.example`.
4. **Deploy**: `POST /api/v1/deploy?uuid=<uuid>`; sigue `GET /api/v1/deployments/<id>`
   hasta `finished`. Las migraciones corren solas al arrancar (entrypoint).
5. **Health**: `curl https://<dominio>/api/health` -> `ok: true` con `version`. Si
   responde 503 `env_invalida`, el cuerpo lista que variable falta.

## 4. Datos demo y cierre

```bash
AGENT_WORKER_SECRET='<el mismo de Coolify>' node scripts/seed-demo.mjs --url https://<dominio>
```

Luego invoca `probar-instancia`. Reporta: URL, credenciales demo (una sola vez),
proyecto Supabase (ref), app de Coolify (uuid), y que quedo pendiente (Zernio, logo
real, dominio de correo).

## Diagnostico rapido

- **El dominio responde dos versiones distintas.** Coolify deja el contenedor viejo
  sirviendo despues de marcar el despliegue como completado: `/api/health` alterna entre
  la version nueva y la anterior. Reinicia la aplicacion y vuelve a comprobar antes de
  buscar la causa en el codigo.

- El build NO necesita variables: si falla pidiendo `DATABASE_URL` o una
  `NEXT_PUBLIC_*`, el culpable es codigo nuevo que consulta la base o lee el entorno al
  importarse (va dentro de la funcion). En Coolify todas las variables van en runtime.
- Health 503 `db_unavailable`: `DATABASE_URL` incorrecta o el proyecto Supabase
  pausado. 503 `config_invalida`: `config/cliente.ts` no pasa la validacion (el
  detalle esta en el cuerpo).
- Migraciones no corren: el contenedor arranca con `SKIP_MIGRATIONS=true`, o
  `DIRECT_URL` apunta al pooler de transacciones (usar el directo).
- `/login` redirige en bucle: `NEXT_PUBLIC_SUPABASE_URL` no apunta al proyecto de esta
  instancia, o `APP_BASE_URL` no es el dominio publico.
