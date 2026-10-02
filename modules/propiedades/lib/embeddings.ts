/**
 * Embeddings con OpenAI (text-embedding-3-small, 1536 dims), directo a OpenAI: OpenRouter
 * no expone /embeddings de forma confiable. Opcional: sin OPENAI_API_KEY la busqueda
 * cae a filtros SQL.
 */
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada (embeddings)");
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embed(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({ model: EMBEDDING_MODEL, input: text.trim() || " " });
  return res.data[0].embedding;
}

export async function embedBatch(texts: string[], batchSize = 100): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize).map((t) => t.trim() || " ");
    const res = await getClient().embeddings.create({ model: EMBEDDING_MODEL, input: slice });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

/** Literal que entiende pgvector: "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
