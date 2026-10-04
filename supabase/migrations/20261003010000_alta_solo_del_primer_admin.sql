-- ============================================================================
-- Builder CRM - que el alta automatica sea SOLO la del primer administrador
-- ============================================================================
-- El disparador daba de alta en team_members a CUALQUIER usuario nuevo de Auth, con
-- rol asesor y activo. Como el endpoint de registro de Supabase Auth es publico por
-- naturaleza (la clave anonima viaja en el navegador), bastaba con llamarlo a mano para
-- entrar al CRM: la pagina /signup cerrada no protegia nada, porque nadie esta obligado
-- a pasar por ella.
--
-- Comprobado: alta directa contra /auth/v1/signup -> sesion valida -> asesor activo ->
-- la bandeja y los contactos cargaban.
--
-- A partir de aca el disparador solo resuelve el arranque: la PRIMERA cuenta de la
-- instancia queda como administradora. Cualquier otro usuario de Auth que aparezca sin
-- invitacion NO entra en team_members y cae en /sin-acceso.
--
-- No rompe el alta desde Ajustes -> Equipo: esa ruta inserta la fila ella misma con el
-- rol que elige el administrador, no dependia de este disparador.
--
-- IMPORTANTE al actualizar una instancia que ya estaba en linea: esto cierra la puerta
-- hacia adelante, pero no borra a quien haya entrado antes. Hay que mirar la lista de
-- Ajustes -> Equipo y desactivar lo que no reconozcas.
-- ============================================================================

create or replace function public.alta_miembro_desde_auth() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hay_miembros boolean;
begin
  select exists (select 1 from public.team_members) into hay_miembros;

  -- Ya hay equipo: el alta la decide un administrador, no el registro de Auth.
  if hay_miembros then
    return new;
  end if;

  insert into public.team_members (id, email, name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'admin',
    true
  )
  on conflict (id) do nothing;

  return new;
end $$;
