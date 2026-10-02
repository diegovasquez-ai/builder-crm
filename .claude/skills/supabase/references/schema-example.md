# Mi Proyecto — Database Schema (EJEMPLO)

> Este es un ejemplo. Reemplaza con las tablas de TU proyecto.
> Usa el MEGAPROMPT en SKILL.md para generarlo automaticamente.

## Project: tu_project_ref
## URL: https://tu_project_ref.supabase.co

## Tables (ejemplo)

### users (CRITICAL - Core)
- id: uuid PK (references auth.users), email: text, full_name: text, avatar_url: text, role: text, status: text, created_at: timestamptz, updated_at: timestamptz

### purchases (CRITICAL - Revenue)
- id: uuid PK, user_id: uuid FK(users), price_cents: integer, currency: text, billing_interval: text (month/year), status: text (completed/canceled/refunded), cancel_at_period_end: boolean, purchased_at: timestamptz, expires_at: timestamptz

### posts (CRITICAL - Content)
- id: uuid PK, author_id: uuid FK(users), title: text, content: text, published: boolean, likes_count: integer, comments_count: integer, created_at: timestamptz

### comments
- id: uuid PK, post_id: uuid FK(posts), author_id: uuid FK(users), content: text, created_at: timestamptz

### funnel_events
- id: uuid PK, event_name: varchar, user_id: uuid, session_id: varchar, utm_source: varchar, utm_medium: varchar, device_type: varchar, created_at: timestamptz

### daily_metrics
- date: date PK, total_users: integer, active_users: integer, new_signups: integer, revenue_cents: integer, mrr_cents: integer, churned: integer, snapshot_at: timestamptz
