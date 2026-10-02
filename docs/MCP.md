# Conectar Claude Code con la infraestructura (MCP y credenciales)

Para que Claude opere Supabase y Coolify desde el chat (flujo one-shot) hace falta
`.mcp.json` en la raiz, que **esta ignorado por git**. Se parte de
`.mcp.json.example`:

```bash
cp .mcp.json.example .mcp.json
```

Los valores `${VAR}` se resuelven desde el entorno de la terminal donde corre Claude
Code: exporta las variables antes de abrirlo. Nunca pegues tokens en claro en el
archivo de ejemplo ni en el repo.

| Servicio | Credencial | Donde se obtiene | Para que la usa Claude |
|---|---|---|---|
| **Supabase** | Inicio de sesion OAuth (lo pide el MCP remoto al abrirse) | supabase.com (la cuenta del miembro) | Crear el proyecto del cliente, aplicar migraciones, leer URL y anon key, revisar `get_advisors` |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` del proyecto | Dashboard -> Project Settings -> API | `npm run admin:crear` y variables de la instancia (no la expone el MCP) |
| Supabase | `DATABASE_URL` (pooler 6543) y `DIRECT_URL` (5432) | Dashboard -> Connect | `npm run db:migrar`, variables de la instancia |
| **Coolify** | URL del panel + API token (scope de escritura o deploy) | Coolify -> Keys & Tokens -> API tokens | Crear la app, variables y deploy (MCP comunitario o `curl` a `/api/v1`) |
| **OpenRouter** | `OPENROUTER_API_KEY` | openrouter.ai -> Keys | El agente de IA (variable de la instancia) |
| **Zernio** | `ZERNIO_API_KEY` (+ `ZERNIO_PROFILE_ID`) | zernio.com -> Settings -> API Keys | `npm run zernio:*`, variables de la instancia |
| **GitHub** | Acceso al repo del cliente (publico, o deploy key en Coolify) | github.com | Coolify construye desde el repo |

## Modo cuenta vs modo proyecto en Supabase

- `https://mcp.supabase.com/mcp` (sin `project_ref`): herramientas de **cuenta**
  (`list_organizations`, `create_project`, `get_cost`, `confirm_cost`) + base de datos.
  Es lo que necesita `deploy-coolify` para crear el proyecto del cliente.
- `...?project_ref=<ref>`: solo ese proyecto; las de cuenta desaparecen. Util para
  trabajar sobre una instancia ya creada. Agregar `&read_only=true` para inspeccion
  segura.

## Coolify sin MCP

`deploy-coolify` funciona con la REST API y `curl`; solo hacen falta
`COOLIFY_URL` y `COOLIFY_TOKEN` en el entorno. La referencia de endpoints esta en
`<COOLIFY_URL>/docs/api` de la instalacion (varia por version).

## Que no hace falta

Vercel, Firebase, un VPS aparte para el agente, ni n8n/Make: el agente corre dentro
de la app (webhook -> `after()` -> worker) y los barridos dentro del proceso en Coolify.
