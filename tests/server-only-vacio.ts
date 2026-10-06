// `server-only` existe para que el bundler falle si un modulo de servidor termina en el
// navegador. En los tests no hay bundler ni navegador: solo node, que ya es el servidor.
// Sin este reemplazo, importar cualquier modulo de servidor (team.ts, auth-correo.ts)
// tira "This module cannot be imported from a Client Component module".
export {};
