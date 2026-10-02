-- Migracion inicial del modulo. Idempotente (if not exists / drop policy if exists).
-- Prefijo obligatorio: <nombre_del_modulo>_<tabla>.

create table if not exists mi_modulo_items (
  id         uuid primary key default gen_random_uuid(),
  contact_id text references contacts(id) on delete cascade,
  nombre     text not null,
  created_at timestamptz not null default now()
);

create index if not exists mi_modulo_items_contact_idx on mi_modulo_items (contact_id);

-- RLS obligatorio: la API publica de Supabase solo deja leer lo que el rol permite.
alter table mi_modulo_items enable row level security;
drop policy if exists mi_modulo_items_select on mi_modulo_items;
create policy mi_modulo_items_select on mi_modulo_items for select to authenticated
  using (contact_id is null or public.contacto_visible(contact_id));
