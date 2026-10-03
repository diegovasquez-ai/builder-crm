-- ============================================================================
-- Builder CRM - Row Level Security
-- ============================================================================
-- Por que: la anon key viaja en el navegador y, sin RLS, PostgREST deja leer y
-- escribir cualquier tabla de `public` con ella. La app escribe por Drizzle con el
-- rol `postgres` (dueno de las tablas, con bypass de RLS), asi que estas politicas
-- NO afectan al CRM: son la red de seguridad de la API publica de Supabase.
--
-- Modelo:
--   anon          -> sin privilegios sobre nada de `public`.
--   authenticated -> solo LECTURA, segun team_members:
--                      admin   ve todo
--                      asesor  ve sus contactos y lo que cuelga de ellos
--                      cada miembro ve sus notificaciones y suscripciones push
--                    Sin politicas de escritura: la app no escribe por PostgREST.
--
-- Las tablas que agregue un modulo tambien deben tener RLS: el runner
-- (scripts/migrar.mjs) lo habilita al final de cada corrida si falta.
-- ============================================================================

-- Funciones de apoyo (security definer: leen team_members aunque RLS aplique) ----
create or replace function public.es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = auth.uid() and active);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = auth.uid() and active and role = 'admin');
$$;

-- true si el usuario de la sesion puede ver ese contacto (admin, o es su propietario).
create or replace function public.contacto_visible(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (select 1 from public.contacts c where c.id = cid and c.owner_id = auth.uid());
$$;

-- anon: nada ------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- RLS en todas las tablas -----------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Politicas de lectura para authenticated -------------------------------------
-- Se recrean siempre (drop + create) para que la migracion sea idempotente.

-- Equipo: cada uno se ve a si mismo; el admin ve a todos.
drop policy if exists team_members_select on team_members;
create policy team_members_select on team_members for select to authenticated
  using (public.es_admin() or id = auth.uid());

-- Contactos y lo que cuelga de ellos.
drop policy if exists contacts_select on contacts;
create policy contacts_select on contacts for select to authenticated
  using (public.es_admin() or owner_id = auth.uid());

drop policy if exists deals_select on deals;
create policy deals_select on deals for select to authenticated
  using (public.contacto_visible(contact_id));

drop policy if exists activities_select on activities;
create policy activities_select on activities for select to authenticated
  using (public.contacto_visible(contact_id));

-- Las tablas de los modulos (visitas, propiedades, ...) NO se tocan aca: cada modulo
-- habilita su RLS y declara su politica en su propia migracion. Si el nucleo las
-- nombrara, una instancia con los modulos apagados no podria migrar.

drop policy if exists documents_select on documents;
create policy documents_select on documents for select to authenticated
  using (public.contacto_visible(contact_id));

drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations for select to authenticated
  using (public.es_admin() or (contact_id is not null and public.contacto_visible(contact_id)));

drop policy if exists messages_select on messages;
create policy messages_select on messages for select to authenticated
  using (
    public.es_admin()
    or (contact_id is not null and public.contacto_visible(contact_id))
    or exists (select 1 from conversations v where v.id = messages.conversation_id
               and v.contact_id is not null and public.contacto_visible(v.contact_id))
  );

drop policy if exists contact_identities_select on contact_identities;
create policy contact_identities_select on contact_identities for select to authenticated
  using (public.contacto_visible(contact_id));

drop policy if exists agent_jobs_select on agent_jobs;
create policy agent_jobs_select on agent_jobs for select to authenticated
  using (public.contacto_visible(contact_id));

drop policy if exists automation_runs_select on automation_runs;
create policy automation_runs_select on automation_runs for select to authenticated
  using (public.es_admin() or (contact_id is not null and public.contacto_visible(contact_id)));

-- Lo propio de cada miembro.
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated
  using (member_id = auth.uid() or public.es_admin());

drop policy if exists push_subscriptions_select on push_subscriptions;
create policy push_subscriptions_select on push_subscriptions for select to authenticated
  using (member_id = auth.uid() or public.es_admin());

-- Catalogos que todo miembro puede leer.
drop policy if exists pipelines_select on pipelines;
create policy pipelines_select on pipelines for select to authenticated using (public.es_miembro());
drop policy if exists pipeline_stages_select on pipeline_stages;
create policy pipeline_stages_select on pipeline_stages for select to authenticated using (public.es_miembro());
drop policy if exists whatsapp_templates_select on whatsapp_templates;
create policy whatsapp_templates_select on whatsapp_templates for select to authenticated using (public.es_miembro());

-- Configuracion y credenciales: solo admin.
drop policy if exists crm_settings_select on crm_settings;
create policy crm_settings_select on crm_settings for select to authenticated using (public.es_admin());
drop policy if exists agent_configs_select on agent_configs;
create policy agent_configs_select on agent_configs for select to authenticated using (public.es_admin());
drop policy if exists automations_select on automations;
create policy automations_select on automations for select to authenticated using (public.es_admin());
drop policy if exists tenants_select on tenants;
create policy tenants_select on tenants for select to authenticated using (public.es_admin());
drop policy if exists channel_accounts_select on channel_accounts;
create policy channel_accounts_select on channel_accounts for select to authenticated using (public.es_admin());
-- whatsapp_accounts guarda el token de Meta: nadie lo lee por la API publica.
-- webhook_events guarda payloads crudos: idem. (RLS activo, sin politicas = nadie.)
