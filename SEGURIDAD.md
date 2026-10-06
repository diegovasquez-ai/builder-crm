# Seguridad: secretos, roles y RLS

Lo minimo que hay que entender antes de desplegar una instancia para un cliente.

## Secretos

- **Todo secreto va en variables de entorno**: `.env.local` en desarrollo (ignorado
  por git) y las variables de la plataforma en Coolify. El repo solo versiona
  `.env.example` y `.mcp.json.example`, sin valores.
- **`NEXT_PUBLIC_*` es publico por diseno**: viaja al navegador. Solo pueden ir ahi la
  URL y la anon key de Supabase, la URL de la app y la clave publica VAPID. Nunca la
  service role, OpenRouter, Zernio ni S3.
- **`.mcp.json` esta en `.gitignore`**: contiene tokens de Coolify/Supabase. Usa
  `${VAR}` y exporta las variables en la terminal.
- **Datos de clientes**: ninguno en seeds, specs, capturas ni commits. El seed de
  demostracion usa nombres y telefonos inventados.
- Antes de publicar un repo: escanear el historial con
  [gitleaks](https://github.com/gitleaks/gitleaks) (`gitleaks git --redact .`) y
  revisar `git grep -n "sk-\|pit-\|EAA"`.
- `whatsapp_accounts.access_token` (conector Meta directo) se guarda en texto plano
  en la base, protegido por RLS (nadie lo lee por la API publica) y por el acceso a
  la base. Pendiente: cifrado en reposo si se completa el conector Cloud API.

## Roles

| Rol | Que ve | Que hace |
|---|---|---|
| **admin** | todo | gestiona equipo, canales, agente, automatizaciones, simulador, borra hilos |
| **asesor** (etiqueta configurable) | solo sus contactos y lo que cuelga de ellos (conversaciones, operaciones, actividades, visitas, documentos) | opera su cartera |

- Supabase Auth dice **quien** entro; `team_members` dice **que es** y si sigue
  activo. Un usuario de Auth que no esta en `team_members` no entra (`/sin-acceso`).
- La **primera cuenta** de una instancia queda como admin (trigger en `auth.users`).
  De ahi en adelante el trigger NO da de alta a nadie: un usuario de Auth sin fila en
  `team_members` cae en `/sin-acceso`. Es importante que sea asi, porque el endpoint de
  registro del proveedor es publico y la pagina `/signup` del CRM, que se cierra sola
  (`ALLOW_PUBLIC_SIGNUP=true` la reabre, solo para pruebas), no puede evitar que lo
  llamen directamente. Las demas cuentas las crea el admin desde Ajustes -> Equipo o con
  `npm run admin:crear`. Como segunda barrera, una vez creado el admin conviene cerrar
  el registro en el proveedor: `GOTRUE_DISABLE_SIGNUP=true` autoalojado, o el
  interruptor de registros en Supabase cloud.
- Toda ruta de datos pasa por `requireMember()` / `requireAdmin()`
  (`src/lib/api-auth.ts`) y filtra con `ownerFilter(member)`; lo que se consulta por
  id verifica `canAccessContactId`. **Lo ajeno responde 404**, no 403: no se confirma
  que exista.
- Rutas con autenticacion propia: webhooks (firma HMAC del proveedor), worker del
  agente, barridos, simulador y seed (admin con sesion o `AGENT_WORKER_SECRET`
  como Bearer). Sin `AGENT_WORKER_SECRET` el worker queda abierto: definirlo siempre.

## Entrar con un proveedor externo

Google y companeros son **opcionales** y no cambian quien entra. El proveedor solo dice
quien es la persona; el acceso lo decide `team_members`. Alguien que entre con Google
sin estar dado de alta en Ajustes -> Equipo termina en `/sin-acceso`, exactamente igual
que si se registrara con email. Configuracion y fallos tipicos en
[docs/GOOGLE-AUTH.md](docs/GOOGLE-AUTH.md).

## RLS (Row Level Security)

- Supabase expone las tablas de `public` por su API REST con la anon key (que esta
  en el navegador). Por eso **toda tabla tiene RLS activado** y `anon` no tiene
  privilegios (`20261001000100_rls.sql`): con la anon key no se lee ni se escribe
  nada.
- `authenticated` tiene **solo politicas de lectura** segun `team_members`: admin
  todo; asesor sus contactos y lo que cuelga de ellos; cada miembro sus
  notificaciones y suscripciones push; catalogos (pipeline, plantillas, propiedades)
  para cualquier miembro; configuracion y credenciales solo admin; `webhook_events` y
  `whatsapp_accounts` nadie.
- **La app no depende de RLS para escribir**: entra con `DATABASE_URL` como `postgres`
  (duena de las tablas, con bypass) y aplica la autorizacion en el servidor. RLS es la
  red de seguridad de la API publica, no la logica de negocio.
- **Modulos**: cada migracion de modulo habilita RLS y define una politica de lectura
  (`public.contacto_visible(contact_id)` si cuelga de un contacto, `public.es_miembro()`
  para catalogos, `public.es_admin()` para lo sensible). `scripts/migrar.mjs` habilita
  RLS en cualquier tabla que quede sin el.
- Verificacion: `get_advisors(security)` del MCP de Supabase no debe reportar tablas
  sin RLS; `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/contacts" -H "apikey: $ANON"`
  debe devolver vacio o error.

## Webhooks y entradas publicas

| Entrada | Proteccion |
|---|---|
| `/api/webhooks/zernio` | HMAC SHA-256 del cuerpo con `ZERNIO_WEBHOOK_SECRET` (fail-closed: sin secreto se rechaza todo); idempotencia por id de evento |
| `/api/webhooks/whatsapp` (Meta directo) | `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`; verify token del hub |
| `/api/webhooks/leads` | header `x-webhook-secret` = `LEADS_WEBHOOK_SECRET` |
| `/api/agent/process`, barridos | `AGENT_WORKER_SECRET` |
| `/api/health` | publico, sin datos sensibles (solo nombres de variables faltantes) |

## Escanear el repo antes de publicarlo

Si vas a hacer publico tu fork, pasale gitleaks al **historial completo**, no al working
tree: lo que se filtro en un commit viejo sigue ahi aunque el archivo ya no exista.

```bash
gitleaks detect --source . --redact
```

En el repo original da un unico hallazgo, y es falso: `docs/GOOGLE-AUTH.md` tiene un
`curl` de ejemplo con el texto `TU_ANON_KEY` donde iria la clave, y la regla
`curl-auth-header` marca cualquier cabecera de autenticacion. La clave anonima, ademas,
es publica por diseno: lo que protege los datos es RLS mas la autorizacion del servidor.

## Checklist antes de entregar una instancia

1. `AGENT_WORKER_SECRET`, `LEADS_WEBHOOK_SECRET` y `ZERNIO_WEBHOOK_SECRET` definidos
   y generados al azar (`openssl rand -hex 32`).
2. `ALLOW_PUBLIC_SIGNUP` sin definir o `false`.
3. La cuenta admin de demo con contrasena generada; pedir al cliente que la cambie.
4. `get_advisors(security)` limpio.
5. `.env.local` y `.mcp.json` fuera del repo del cliente (`git status`).

## Reportar una vulnerabilidad

Abrir un issue privado en el repo original o escribir al mantenedor de la
comunidad. No publicar detalles explotables en issues publicos.
