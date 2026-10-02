# Spec: Base desplegable (requisito 6 del brief)

**Carril**: completo (toca modelo de datos, contratos y nucleo)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

Hoy una instancia nueva no se puede levantar desde el repo: las tablas base solo
existen en una carpeta gitignored (`drizzle/`), las 8 migraciones de
`supabase/migrations/` alteran tablas que ninguna crea, cada una tiene su script de
aplicacion a mano, ninguna tabla tiene RLS (la API publica de Supabase expone todo con
la anon key), no hay health check, el Dockerfile es de la era SQLite y ~20 rutas de API
aceptan a cualquier usuario de Auth aunque no sea miembro del equipo.

## Decisiones del dueno

- D1 La base sigue siendo Supabase, un proyecto por cliente. Coolify corre solo la app.
- D2 Hasta la version 1.0.0 la migracion base se regenera desde el schema cuando cambia;
  desde 1.0.0 solo se agregan migraciones nuevas.
- D3 Vercel sigue soportado como alternativa; en Coolify los barridos corren dentro del
  proceso.

## Escenarios

1. **Instalar** — Con un proyecto Supabase vacio y `DATABASE_URL`, `npm run db:migrar`
   deja la base lista (tablas, indices, funciones, semillas, RLS) y es idempotente.
2. **Arrancar** — El contenedor corre las migraciones pendientes y recien despues
   levanta el servidor; si la base no responde, reintenta antes de rendirse.
3. **Verificar** — `GET /api/health` responde `{ok:true, version, commit, db:"ok"}`
   sin sesion; con la base caida responde 503.
4. **Primer acceso** — Si no hay nadie en `team_members`, la pantalla de registro esta
   abierta y la primera cuenta queda como `admin`; despues el registro se cierra solo
   (salvo `ALLOW_PUBLIC_SIGNUP=true`). Alternativa sin UI:
   `npm run admin:crear -- --email ... --password ...`.
5. **Proteger** — Un usuario de Auth que no esta en `team_members` recibe 403 en toda
   ruta de datos; un asesor no puede leer ni editar una operacion, actividad o
   conversacion de un contacto ajeno (404).
6. **Exponer nada** — Con la anon key, `GET /rest/v1/contacts` devuelve vacio o 401:
   RLS activo en todas las tablas y privilegios de `anon` revocados.

## Requisitos

- FR-001 `supabase/migrations/` DEBE poder aplicarse en orden sobre una base vacia y
  producir el schema que `src/db/schema.ts` describe.
- FR-002 `scripts/migrar.mjs` DEBE registrar lo aplicado en `public._migraciones`,
  aplicar cada archivo en una transaccion, aceptar `--dry-run` y `--status`, y
  reintentar la conexion (15 intentos, 2 s) para el arranque del contenedor.
- FR-003 Toda tabla de `public` DEBE tener RLS habilitado; el runner lo verifica al
  final de cada corrida y lo habilita si falta (cubre tablas de modulos).
- FR-004 `anon` NO DEBE tener privilegios sobre tablas, secuencias ni funciones de
  `public`. `authenticated` DEBE poder leer solo lo que su rol permite (admin todo;
  asesor sus contactos y lo que cuelga de ellos; cada miembro sus notificaciones);
  sin politicas de escritura (la app escribe por Drizzle como `postgres`).
- FR-005 Un trigger sobre `auth.users` DEBE crear la fila de `team_members`; la
  primera como `admin`, las siguientes como `asesor`. El alta desde Ajustes -> Equipo
  DEBE seguir funcionando (upsert, no insert).
- FR-006 DEBE existir `src/lib/env.ts` con validacion zod lazy; `/api/health` DEBE
  reportar variables obligatorias faltantes sin exponer valores.
- FR-007 `next.config.ts` DEBE usar `output: "standalone"` (salvo en Windows) y
  exponer version (`package.json`) y commit (`SOURCE_COMMIT`) al cliente.
- FR-008 `Dockerfile` multi-stage con usuario sin privilegios, `HEALTHCHECK` sobre
  `/api/health`, y `ENTRYPOINT` que migra y arranca. `docker-compose.yml` solo con la
  app (la base es Supabase).
- FR-009 Toda ruta de `/api` salvo health, webhooks y workers con secreto DEBE pasar por
  `requireMember`/`requireAdmin`; las rutas por id DEBEN verificar acceso al contacto.
- FR-010 En Coolify (sin `VERCEL`), `instrumentation.ts` DEBE correr los barridos cada
  30 min contra los endpoints existentes con `AGENT_WORKER_SECRET`.

## Configuracion y modulos

Ninguno todavia (Fases 3 y 4). El runner deja previsto `modules/*/migrations/`.

## Modelo de datos

- `20261001000000_base.sql`: extensiones, 21 tablas, FKs, indices, `match_properties`,
  tenant `default`, `agent_configs` por canal, automatizacion semilla.
- `20261001000100_rls.sql`: funciones `es_admin()`, `es_miembro()`,
  `contacto_visible(id)`; RLS en todo; revoke anon; politicas de lectura.
- `20261001000200_primer_admin.sql`: trigger `on_auth_user_created`.
- Se eliminan las 8 migraciones viejas y los 5 scripts `apply-*`.

## Agente de IA

Sin cambios.

## Criterios de aceptacion

- CA-001 `npm run db:migrar` sobre un proyecto Supabase vacio termina sin error y una
  segunda corrida no aplica nada.
- CA-002 `get_advisors(security)` de Supabase no reporta tablas sin RLS.
- CA-003 `curl $URL/api/health` → 200 con `ok:true`; sin `DATABASE_URL` valida → 503.
- CA-004 `docker build` termina y el contenedor pasa el `HEALTHCHECK`.
- CA-005 Con la anon key, `GET /rest/v1/contacts` no devuelve filas.
- CA-006 Un usuario de Auth sin fila en `team_members` recibe 403 en `/api/contacts`.
- CA-007 `npm run typecheck && npm run lint && npm run build` en verde.

## Constitution Check

- I. Nucleo intocable: es el nucleo; no toca nada de cliente.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: CA-001..007, y `probar-instancia` usa `/api/health`.
- IV. Cero secretos: `.env.example` sin valores; `SOURCE_COMMIT` no es secreto.

## Fuera de alcance

- Politicas de escritura por RLS: la app no usa PostgREST para escribir.
- Cifrar `whatsapp_accounts.access_token` en reposo (queda anotado en SEGURIDAD.md).
- Publicar imagen en GHCR (opcional, Fase 10).
