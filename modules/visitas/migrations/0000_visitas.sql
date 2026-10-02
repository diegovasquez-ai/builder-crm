-- Modulo visitas. Idempotente.

create table if not exists visitas (
  id               text primary key,
  contact_id       text not null references contacts(id) on delete cascade,
  deal_id          text references deals(id) on delete set null,
  property_address text,
  status           text not null default 'coordinating',
  scheduled_at     timestamptz,
  duration_minutes integer not null default 60,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists visitas_contact_idx   on visitas (contact_id);
create index if not exists visitas_scheduled_idx on visitas (scheduled_at);
create index if not exists visitas_status_idx    on visitas (status);

-- RLS: cada miembro lee las visitas de sus contactos; el admin todas.
alter table visitas enable row level security;
drop policy if exists visitas_select on visitas;
create policy visitas_select on visitas for select to authenticated
  using (public.contacto_visible(contact_id));
