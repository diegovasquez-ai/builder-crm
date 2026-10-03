-- ============================================================================
-- Builder CRM - borrar un contacto tiene que llevarse lo que cuelga de el
-- ============================================================================
-- Tres claves ajenas hacia contacts quedaron en NO ACTION: activities, deals y
-- messages. Con eso, DELETE /api/contacts/:id falla en cuanto el contacto tiene una
-- actividad, y todos la tienen: la ingesta, el agente y las automatizaciones escriben
-- actividades. El sintoma es un 500 al borrar, no un mensaje claro.
--
-- Las que SI tienen que sobrevivir al borrado no se tocan: automation_runs y
-- notifications quedan con SET NULL, porque son registro de lo que paso.
--
-- Se busca la restriccion por su definicion y no por su nombre, para que funcione
-- aunque una instancia la tenga nombrada de otra forma.
-- ============================================================================

do $$
declare
  t text;
  nombre text;
begin
  foreach t in array array['activities', 'deals', 'messages'] loop
    select c.conname into nombre
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_class dst on dst.oid = c.confrelid
    join pg_attribute a on a.attrelid = src.oid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and src.relname = t
      and dst.relname = 'contacts'
      and a.attname = 'contact_id'
      and c.confdeltype <> 'c'
    limit 1;

    if nombre is not null then
      execute format('alter table public.%I drop constraint %I', t, nombre);
      execute format(
        'alter table public.%I add constraint %I foreign key (contact_id) references public.contacts(id) on delete cascade',
        t,
        t || '_contact_id_contacts_id_fk'
      );
      raise notice 'cascada activada en %.contact_id (la restriccion se llamaba %)', t, nombre;
    end if;

    nombre := null;
  end loop;
end $$;
