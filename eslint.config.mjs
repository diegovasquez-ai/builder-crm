import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // DEUDA CONOCIDA, a proposito y con fecha. La regla llego activa al actualizar a
      // eslint-config-next 16.4.3 (en 16.2.2 no estaba) y marca 9 sitios que ya existian:
      // componentes que cargan datos con `useEffect(() => { load() }, [load])` donde
      // `load` toca el estado antes del primer `await`. Provoca renders en cascada al
      // montar; no es un fallo de correccion ni de seguridad.
      //
      // Queda en `warn` y no en `error` porque arreglarlo bien es reestructurar la carga
      // de datos de nueve componentes y eso no entra en una version de seguridad: cada
      // uno necesita que alguien recorra la pantalla y compruebe los estados de carga.
      // Sigue saliendo en cada `npm run lint` para que no se olvide.
      //
      // Los nueve: app/plantillas/page.tsx, contacts/OwnerSelect, conversations/
      // ContactDetailPanel, conversations/TemplatePicker, pipeline/KanbanBoard,
      // pipeline/PipelineEditor, settings/AgentSettings, settings/ChannelsSettings,
      // lib/use-push.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
