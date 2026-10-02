-- ============================================================================
-- Builder CRM - alta automatica en team_members y primer administrador
-- ============================================================================
-- Supabase Auth dice QUIEN entro; `team_members` dice QUE ES (admin o asesor).
-- Este trigger crea la fila espejo al nacer el usuario de Auth:
--   - la PRIMERA cuenta de la instancia queda como admin (bootstrap sin SQL a mano),
--   - las siguientes como asesor (Ajustes -> Equipo las crea y les fija el rol con un
--     upsert, asi que el valor de aca es solo el default).
-- ============================================================================

create or replace function public.alta_miembro_desde_auth() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  es_primero boolean;
begin
  select not exists (select 1 from public.team_members) into es_primero;

  insert into public.team_members (id, email, name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when es_primero then 'admin' else 'asesor' end,
    true
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.alta_miembro_desde_auth();
