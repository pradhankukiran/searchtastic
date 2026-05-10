import { getDomain } from "@/lib/search/filter";
import type { SearchEngine, SearchResult } from "@/lib/search/types";

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  engines?: string[];
};

type SearxngResponse = {
  results?: SearxngResult[];
  unresponsive_engines?: unknown[];
};

export async function searchSearxng({
  query,
  engines,
  configuredEngines,
}: {
  query: string;
  engines: string[];
  configuredEngines: SearchEngine[];
}) {
  const baseUrl = process.env.SEARXNG_URL;

  if (!baseUrl) {
    throw new Error("Missing SEARXNG_URL environment variable.");
  }

  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("engines", engines.join(","));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Searchtastic/0.1",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`SearXNG returned ${response.status}.`);
  }

  const payload = (await response.json()) as SearxngResponse;
  const engineById = new Map(configuredEngines.map((engine) => [engine.id, engine]));

  return (payload.results ?? [])
    .filter((result): result is Required<Pick<SearxngResult, "title" | "url">> & SearxngResult =>
      Boolean(result.title && result.url),
    )
    .map<SearchResult>((result) => {
      const domain = getDomain(result.url);
      const engineId = resolveEngineId(result, engineById);
      const engine = engineById.get(engineId);

      return {
        title: result.title,
        url: result.url,
        content: result.content ?? "",
        engine: engineId,
        category: engine?.category ?? "uncategorized",
        domain,
        whitelisted: false,
      };
    });
}

function resolveEngineId(result: SearxngResult, engineById: Map<string, SearchEngine>) {
  const candidates = [result.engine, ...(result.engines ?? [])]
    .filter((engine): engine is string => Boolean(engine))
    .map((engine) => engine.toLowerCase());

  return candidates.find((engine) => engineById.has(engine)) ?? candidates[0] ?? "searxng";
}
