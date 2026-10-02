---
name: supabase
description: |
  Todo lo relacionado con Supabase: crear tablas, migraciones, RLS, queries, metricas, CRUD,
  auth, storage, logs, y operaciones de datos.
  Activar cuando el usuario dice: necesito una tabla, crear tabla, base de datos, guardar datos,
  proteger datos, RLS, migracion, query, cuantos usuarios, metricas, revenue, dame los datos,
  consulta supabase, cuantos registros, analiza los datos, estadisticas, reportes, churn,
  funnel, storage, auth, configurar permisos, o cualquier operacion de BD.
allowed-tools: Bash(curl *) Bash(export *) Bash(grep *) Bash(python3 *) Read, Write, Edit, Grep
metadata:
  author: saas-factory
  version: "2.0"
---

# Supabase — Tu Base de Datos Completa

Estructura, datos, seguridad, y metricas. Todo en un solo lugar.

---

## Setup Inicial (Una Sola Vez)

### Paso 1: Credenciales

| Key | Donde encontrarla | Para que |
|-----|-------------------|----------|
| **Service Role Key** | Dashboard → Settings → API → `service_role` | Queries directos (bypassa RLS) |
| **Personal Access Token** | supabase.com/dashboard/account/tokens | Management API (SQL raw, logs) |

### Paso 2: Guardar en `.env`

```bash
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...tu_service_role_key
SUPABASE_PAT=sbp_...tu_personal_access_token
SUPABASE_PROJECT_REF=tu_project_ref
```

### Paso 3: Documentar tu schema

Ejecuta el MEGAPROMPT al final de este archivo para generar `references/schema.md` automaticamente.

---

## Cargar Credenciales

SIEMPRE ejecutar antes de cualquier query:

```bash
export SUPABASE_URL=$(grep '^SUPABASE_URL=' .env | cut -d= -f2)
export SUPABASE_SERVICE_KEY=$(grep '^SUPABASE_SERVICE_KEY=' .env | cut -d= -f2)
export SUPABASE_PAT=$(grep '^SUPABASE_PAT=' .env | cut -d= -f2)
export SUPABASE_PROJECT_REF=$(grep '^SUPABASE_PROJECT_REF=' .env | cut -d= -f2)
```

---

## MCP: Estructura y Exploracion

Si tienes `@supabase/mcp-server-supabase` en `.mcp.json`:

### Explorar
```
list_tables                    -- Ver estructura de BD
execute_sql("SELECT ...")      -- Consultar datos
get_logs(service: "auth")      -- Depurar auth
get_logs(service: "postgres")  -- Depurar BD
```

### Crear/Modificar Estructura (DDL)
```
apply_migration(
  name: "nombre_descriptivo",
  query: "CREATE TABLE | ALTER TABLE | CREATE INDEX"
)
```

### Verificar Seguridad
```
get_advisors(type: "security") -- Detecta tablas sin RLS
search_docs("consulta aqui")   -- Buscar en docs oficiales
```

---

## HTTP: Datos y Operaciones

### PostgREST (CRUD rapido)

```bash
curl -s "$SUPABASE_URL/rest/v1/TABLA?FILTROS" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

### Management API (SQL raw)

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "TU SQL AQUI"}'
```

**Cuando usar cada uno:**
- **MCP** → explorar, migraciones, verificar seguridad
- **PostgREST** → CRUD, filtros, paginacion, scripts
- **Management API** → JOINs, aggregations, SQL complejo, logs

---

## Patron: Crear Tabla con RLS

```sql
-- 1. Crear la tabla
apply_migration(
  name: "create_profiles",
  query: "
    CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      username TEXT UNIQUE,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  "
)

-- 2. Habilitar RLS
apply_migration(
  name: "enable_rls_profiles",
  query: "ALTER TABLE profiles ENABLE ROW LEVEL SECURITY"
)

-- 3. Politicas
apply_migration(
  name: "profiles_select_own",
  query: "
    CREATE POLICY profiles_select_own ON profiles
    FOR SELECT USING (auth.uid() = id)
  "
)

apply_migration(
  name: "profiles_update_own",
  query: "
    CREATE POLICY profiles_update_own ON profiles
    FOR UPDATE USING (auth.uid() = id)
  "
)

-- 4. Verificar
get_advisors(type: "security")
```

### Claves Foraneas
```sql
apply_migration(
  name: "create_posts",
  query: "
    CREATE TABLE posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      published BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  "
)
```

### Indices
```sql
-- Simple
apply_migration(name: "idx_posts_user_id", query: "CREATE INDEX idx_posts_user_id ON posts(user_id)")

-- Compuesto
apply_migration(name: "idx_posts_user_published", query: "CREATE INDEX idx_posts_user_published ON posts(user_id, published)")

-- Parcial
apply_migration(name: "idx_posts_published", query: "CREATE INDEX idx_posts_published ON posts(created_at) WHERE published = true")
```

---

## PostgREST — Referencia Rapida

### Filtros

| Operador | Significado | Ejemplo |
|----------|-------------|---------|
| `eq` | Igual | `status=eq.active` |
| `neq` | No igual | `status=neq.deleted` |
| `gt` / `gte` | Mayor / mayor-igual | `price_cents=gt.1000` |
| `lt` / `lte` | Menor / menor-igual | `created_at=lte.2026-01-01` |
| `like` / `ilike` | Patron | `email=ilike.*@gmail.com` |
| `in` | En lista | `status=in.(active,trialing)` |
| `is` | Null check | `deleted_at=is.null` |
| `not` | Negacion | `status=not.eq.canceled` |
| `cs` | Contains (arrays) | `tags=cs.{premium}` |

### Ordenar y Paginar

| Parametro | Ejemplo |
|-----------|---------|
| Ordenar | `order=created_at.desc` |
| Limitar | `limit=10` |
| Offset | `offset=20` |
| Seleccionar columnas | `select=id,name,email` |
| Contar total | Header: `Prefer: count=exact` + `-I` |

### CRUD Completo

**Listar:**
```bash
curl -s "$SUPABASE_URL/rest/v1/users?select=id,email,created_at&status=eq.active&order=created_at.desc&limit=20" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

**Contar:**
```bash
curl -s "$SUPABASE_URL/rest/v1/users?select=id&status=eq.active" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Prefer: count=exact,head=true" -I 2>/dev/null | grep -i content-range
```

**Insertar:**
```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/users" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"email": "test@example.com", "name": "Test User"}'
```

**Actualizar:**
```bash
curl -s -X PATCH "$SUPABASE_URL/rest/v1/users?id=eq.UUID_AQUI" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status": "inactive"}'
```

**Upsert:**
```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/metrics" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d '{"date": "2026-03-16", "value": 100}'
```

**Filtrar por fecha (ultimos 7 dias):**
```bash
curl -s "$SUPABASE_URL/rest/v1/events?created_at=gte.$(date -u -v-7d +%Y-%m-%dT00:00:00Z)&order=created_at.desc" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

---

## Management API — SQL Raw

**Usuarios por dia:**
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT date_trunc('\''day'\'', created_at)::date as day, count(*) FROM users WHERE created_at >= now() - interval '\''30 days'\'' GROUP BY 1 ORDER BY 1"}'
```

**Revenue total:**
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT sum(price_cents)/100.0 as revenue_usd, count(*) as total FROM purchases WHERE status = '\''completed'\''"}'
```

**Top N con JOIN:**
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT u.email, count(o.id) as orders FROM users u JOIN orders o ON o.user_id = u.id GROUP BY u.email ORDER BY orders DESC LIMIT 10"}'
```

**Logs:**
```bash
curl -s "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/analytics/endpoints/logs.all?iso_timestamp_start=$(date -u -v-1d +%Y-%m-%dT00:00:00Z)" \
  -H "Authorization: Bearer $SUPABASE_PAT"
```

---

## Patron: Metricas de Negocio

Adapta nombres de tabla y columnas a tu schema:

### MRR (Monthly Recurring Revenue)
```bash
curl -s "$SUPABASE_URL/rest/v1/purchases?select=price_cents,billing_interval&status=eq.completed&cancel_at_period_end=eq.false" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" | python3 -c "
import sys,json; data=json.load(sys.stdin)
mrr=sum(r['price_cents']/(12 if r.get('billing_interval')=='year' else 1) for r in data)
print(f'MRR: \${mrr/100:,.2f} USD ({len(data)} suscripciones activas)')
"
```

### Churn Signal
```bash
curl -s "$SUPABASE_URL/rest/v1/purchases?select=id&status=eq.completed&cancel_at_period_end=eq.true" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" | python3 -c "
import sys,json; print(f'Van a cancelar: {len(json.load(sys.stdin))}')
"
```

### Funnel de Conversion
```bash
curl -s "$SUPABASE_URL/rest/v1/funnel_events?select=event_name&created_at=gte.$(date -u -v-7d +%Y-%m-%dT00:00:00Z)" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" | python3 -c "
import sys,json,collections; data=json.load(sys.stdin)
counts=collections.Counter(r['event_name'] for r in data)
for k,v in counts.most_common(): print(f'{k}: {v}')
"
```

---

## Patron: BI Snapshot (Metricas Diarias)

Tabla que se llena cada noche con un snapshot de tus KPIs:

```sql
CREATE TABLE daily_metrics (
  date DATE PRIMARY KEY,
  total_users INTEGER,
  active_users INTEGER,
  new_signups INTEGER,
  revenue_cents INTEGER,
  mrr_cents INTEGER,
  churned INTEGER,
  snapshot_at TIMESTAMPTZ DEFAULT now()
);
```

Script de snapshot:
```bash
TOTAL=$(curl -s "$SUPABASE_URL/rest/v1/users?select=id" -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" -H "Prefer: count=exact,head=true" -I 2>/dev/null | grep -i content-range | sed 's/.*\///')

curl -s -X POST "$SUPABASE_URL/rest/v1/daily_metrics" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d "{\"date\": \"$(date +%Y-%m-%d)\", \"total_users\": $TOTAL}"
```

---

## MEGAPROMPT: Documentar tu Schema

Copia y pega en Claude Code:

```
Documenta el schema completo de mi base de datos Supabase.

1. Ejecuta: list_tables
2. Para cada tabla: execute_sql("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'NOMBRE_TABLA' ORDER BY ordinal_position")
3. Genera references/schema.md con formato:

# [Mi Proyecto] -- Database Schema
## Project: [project_ref]
## Tables ([N] total)

### nombre_tabla (CRITICAL - [dominio])
- columna1: tipo, columna2: tipo, ...

Marca CRITICAL las tablas mas importantes (usuarios, compras, contenido).
Agrupa por dominio (Core, Content, Analytics, etc.).
```

---

## Principios

1. **RLS Siempre**: Toda tabla con datos de usuario debe tener RLS habilitado
2. **Migraciones Nombradas**: Nombres descriptivos para tracking
3. **apply_migration para DDL**: CREATE, ALTER, DROP
4. **execute_sql para DML**: SELECT, INSERT, UPDATE, DELETE
5. **get_advisors despues de crear tablas**: Verificar seguridad
6. **NUNCA fabricar datos**: Si un query falla, decirlo
7. **NUNCA mezclar ventanas de tiempo**: Advertir si se comparan periodos incompatibles
8. **Verificar con queries reales**: No confiar en docs desactualizados
9. **Service Role Key bypassa RLS**: Solo en desarrollo/admin
10. **Documentar tu schema**: Claude es 10x mas util cuando conoce tus tablas

---

## Flujo de Trabajo

```
Estructura:
  list_tables → disenar → apply_migration → RLS → policies → get_advisors → test data

Datos:
  Cargar credenciales → PostgREST (CRUD) o Management API (SQL) → verificar resultado
```

## Referencia: Tu Schema

Si documentaste tu schema, esta en `references/schema.md`. Leelo antes de cualquier query.
