import "server-only";

const API_BASE = "https://api.firecrawl.dev/v2";

export interface ScrapeResult {
  ok: boolean;
  markdown?: string;
  title?: string;
  url?: string;
  error?: string;
}

/** Scrapea una URL (portal inmobiliario) con Firecrawl y devuelve markdown. Opcional. */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { ok: false, error: "FIRECRAWL_API_KEY no configurada" };

  try {
    const res = await fetch(`${API_BASE}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 30000 }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Firecrawl ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
      error?: string;
    };
    if (!json.success || !json.data) return { ok: false, error: json.error ?? "Firecrawl sin data" };
    return { ok: true, markdown: json.data.markdown, title: json.data.metadata?.title, url: json.data.metadata?.sourceURL ?? url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}
