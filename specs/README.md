# specs/

Especificaciones de Builder CRM. Una spec se escribe **antes** del codigo
(constitucion, principio II). Si se escribio despues, lo dice en su encabezado.

| Carpeta | Que hay |
|---|---|
| `CONSTITUCION.md` | Los cuatro principios no negociables y la gobernanza. |
| `_brief.md` | Que preguntarle al cliente antes de empezar. Se copia a `<cliente>/brief.md` y es la entrada de `adaptar-a-cliente`. |
| `_plantilla.md` | Plantilla de spec. Se copia a `<cliente>/spec.md` o `nucleo/NN-nombre.md`. |
| `nucleo/` | Specs del nucleo (reportes, configuracion, modulos, conectores, agente, simulador, base desplegable, plantilla inmobiliaria, entrar con un proveedor externo, correos de acceso, modo local, zona horaria). Las de proveedor externo, correos de acceso y modo local se escribieron **despues** del codigo y lo dicen en su encabezado. |
| `inmobiliaria/` | Ejemplo completo: la spec de la plantilla inmobiliaria, tal como quedaria la de un cliente de ese nicho. |
| `<cliente>/` | La spec de cada adaptacion (la crea `adaptar-a-cliente`). No se versiona en el repo original: vive en el repo de cada cliente. |

## Carriles

- **Completo**: toca el modelo de datos, un contrato publico (API, webhook, interfaz
  de conector o de modulo) o el nucleo. Lleva todas las secciones de la plantilla.
- **Ligero**: configuracion, un modulo o UI. Alcanza con problema, escenarios,
  requisitos, configuracion/modulos y criterios de aceptacion.

Cada spec termina con un **Constitution Check** (una linea por principio) y una
seccion **Fuera de alcance** con lo que se decidio no hacer y por que.
