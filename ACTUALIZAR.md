# Actualizar una instancia desde el repo original

Cada cliente vive en su propio repo (fork o clon de Builder CRM) con su zona del
cliente encima del nucleo. Traer una version nueva del original es un merge: si la
adaptacion respeto las zonas, no hay conflictos. Esto mismo lo hace la skill
`actualizar-desde-original`.

## 1. Agregar el original como `upstream` (una vez)

```bash
git remote add upstream https://github.com/diegovasquez-ai/builder-crm.git
git fetch upstream --tags
```

## 2. Leer que cambia

En [`CHANGELOG.md`](CHANGELOG.md) de upstream, la seccion **"Actualizar desde X.Y.Z"**
de cada version entre la tuya y la nueva dice: variables de entorno nuevas,
migraciones, pasos manuales. Una version **mayor** siempre trae pasos manuales; una
menor o un parche, no.

## 3. Mezclar

```bash
git status                       # todo commiteado
git merge upstream/main          # o la etiqueta: git merge v1.1.0
```

Reglas para conflictos:

| Archivo en conflicto | Gana |
|---|---|
| `config/`, `modules/<tuyo>/`, `public/marca/`, `specs/<cliente>/` | **tu version** (es del cliente) |
| `src/`, `supabase/`, `scripts/`, Docker | **upstream** (es nucleo). Si lo habias tocado, mueve ese cambio a un modulo o a la config, o proponlo al original. |
| `src/lib/modules/*.generated.ts` | cualquiera; luego `npm run modulos:registro` |
| `modules/ejemplo/`, `modules/_plantilla/`, `modules/propiedades/`, `modules/visitas/` | upstream (son del original); si los modificaste, es una mejora para proponer |

## 4. Aplicar

```bash
npm install
npm run typecheck && npm run lint && npm run build
npm run db:migrar
```

Compara `.env.example` nuevo con tus variables (en Coolify o `.env.local`) y agrega las
que falten antes de desplegar.

## 5. Desplegar y verificar

Redeploy en Coolify (las migraciones corren al arrancar) y:

```bash
curl https://<dominio>/api/health
node scripts/verificar-instancia.mjs --url https://<dominio> --email ... --password ...
```

Si un modulo tuyo dejo de compilar, el CHANGELOG de esa version mayor dice que cambio
en el contrato (`src/lib/modules/types.ts` o `src/lib/channels/conector.ts`).

## Mantener facil la actualizacion

- Nunca editar el nucleo en la instancia (constitucion, principio I).
- Modulos propios con nombres distintos de los del original.
- Commits chicos y descriptivos en la zona del cliente.
- Antes de 1.0.0 la migracion `0000_base.sql` se regeneraba; desde 1.0.0 el original
  solo agrega archivos de migracion, nunca edita los existentes.
