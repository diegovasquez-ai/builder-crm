-- Modulo ejemplo: tareas personales por miembro. Idempotente.
-- Las tablas de un modulo llevan el nombre del modulo como prefijo para no chocar
-- con el nucleo ni con otros modulos.

create table if not exists ejemplo_tareas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  hecha      boolean not null default false,
  member_id  uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ejemplo_tareas_member_idx on ejemplo_tareas (member_id, hecha, created_at desc);

-- RLS obligatorio (constitucion IV). La app escribe por Drizzle (bypass); esto
-- protege la API publica de Supabase: cada miembro lee solo lo suyo.
alter table ejemplo_tareas enable row level security;
drop policy if exists ejemplo_tareas_select on ejemplo_tareas;
create policy ejemplo_tareas_select on ejemplo_tareas for select to authenticated
  using (member_id = auth.uid() or public.es_admin());
