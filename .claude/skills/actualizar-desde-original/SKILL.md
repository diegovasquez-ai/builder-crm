---
name: actualizar-desde-original
description: |
  Trae una version nueva del repo original de Builder CRM a una instancia ya adaptada
  (fork o clon de un cliente) sin perder la personalizacion: upstream, merge, migraciones,
  verificacion. Activar cuando el usuario dice: actualiza el CRM, hay version nueva, trae
  los cambios del original, sync con upstream, actualizar desde el repo de la comunidad.
allowed-tools: Bash, Read, Edit, Grep
---

# Actualizar desde el repo original

> Instancia: $ARGUMENTS

La personalizacion vive en la **zona del cliente** (`config/`, `modules/`,
`public/marca/`, `specs/<cliente>/`); el nucleo (`src/`, `supabase/`, `scripts/`,
Docker) viene del original. Si la adaptacion respeto eso, actualizar es un merge sin
conflictos. Guia completa para humanos: `ACTUALIZAR.md`.

## 1. Preparar

```bash
git status                      # limpio; si no, commit o stash
git remote add upstream https://github.com/diegovasquez-ai/builder-crm.git   # una sola vez
git fetch upstream --tags
```

Lee en `CHANGELOG.md` de upstream la seccion **"Actualizar desde X.Y.Z"** de cada
version intermedia: ahi estan las variables nuevas, migraciones y pasos manuales.
Una version **mayor** siempre tiene pasos manuales; una menor o parche, no.

## 2. Mezclar

```bash
git merge upstream/main          # o la etiqueta vX.Y.Z
```

Si hay conflictos:
- En la **zona del cliente** gana la version local (es del cliente).
- En el **nucleo** gana upstream; si la instancia habia tocado el nucleo, eso era una
  excepcion a la constitucion: resolver con upstream y mover el cambio a un modulo o a
  la config, o proponerlo al original.
- `src/lib/modules/*.generated.ts`: tomar cualquiera y regenerar
  (`npm run modulos:registro`).
- La migracion base (`supabase/migrations/20261001000000_base.sql`): antes de 1.0.0 se regeneraba; desde 1.0.0 solo
  se agregan archivos, asi que no debe haber conflicto. Si lo hay, gana upstream.

## 3. Aplicar

```bash
npm install
npm run typecheck && npm run lint && npm run build
npm run db:migrar            # nuevas migraciones del nucleo y de los modulos
```

Variables nuevas: `.env.example` de upstream vs `.env.local` / Coolify (`diff`).
Agregarlas antes de desplegar.

## 4. Desplegar y verificar

Deploy en Coolify (redeploy de la app) y `probar-instancia`. Si un modulo del cliente
dejo de compilar porque el contrato cambio (version mayor), el CHANGELOG dice que
cambio; adaptar el modulo y volver a probar.

Commit del merge: `Actualizar nucleo a vX.Y.Z`. Anotar en `.claude/memory/` cualquier
cosa no obvia que haya pasado en esta actualizacion.
