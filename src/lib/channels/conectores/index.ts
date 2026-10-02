import "server-only";
import type { Conector, ConversationRow, EstadoConector } from "../conector";
import { zernio } from "./zernio";
import { metaCloud } from "./meta-cloud";
import { simulador } from "./simulador";

/**
 * Registro de conectores. La clave es `conversations.provider`.
 * Para agregar uno: crear el archivo al lado, importarlo y sumarlo aqui (ver README.md).
 */
const CONECTORES: Record<string, Conector> = {
  [zernio.id]: zernio,
  [metaCloud.id]: metaCloud,
  [simulador.id]: simulador,
};

export function listarConectores(): Conector[] {
  return Object.values(CONECTORES);
}

export function obtenerConector(id: string): Conector | null {
  return CONECTORES[id] ?? null;
}

export function conectorParaConversacion(conversation: ConversationRow): Conector | null {
  return obtenerConector(conversation.provider);
}

/** Estado de todos los conectores, para Ajustes -> Canales y para probar-instancia. */
export async function estadoConectores(): Promise<EstadoConector[]> {
  return Promise.all(listarConectores().map((c) => c.estado()));
}
