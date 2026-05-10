import { getDomain } from "@/lib/search/filter";
import type {
  SafeSearchLevel,
  SearchEngine,
  SearchMeta,
  SearchResult,
  SearchTimeRange,
} from "@/lib/search/types";

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  engines?: string[];
  thumbnail?: string;
  img_src?: string;
  publishedDate?: string;
  published_date?: string;
  template?: string;
  category?: string;
};

type SearxngResponse = {
  results?: SearxngResult[];
  number_of_results?: number;
  suggestions?: string[];
  answers?: string[];
  corrections?: string[];
  infoboxes?: unknown[];
  unresponsive_engines?: unknown[];
};

export async function searchSearxng({
  query,
  engines,
  categories,
  configuredEngines,
  language,
  pageno,
  timeRange,
  safeSearch,
  enabledPlugins,
  imageProxy,
}: {
  query: string;
  engines: string[];
  categories: string[];
  configuredEngines: SearchEngine[];
  language: string;
  pageno: number;
  timeRange: SearchTimeRange;
  safeSearch: SafeSearchLevel;
  enabledPlugins: string[];
  imageProxy: boolean;
}) {
  const baseUrl = process.env.SEARXNG_URL;

  if (!baseUrl) {
    throw new Error("Missing SEARXNG_URL environment variable.");
  }

  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageno", String(pageno));
  url.searchParams.set("safesearch", safeSearch);
  url.searchParams.set("image_proxy", imageProxy ? "1" : "0");

  if (engines.length > 0) {
    url.searchParams.set("engines", engines.join(","));
  }

  if (categories.length > 0) {
    url.searchParams.set("categories", categories.join(","));
  }

  if (language) {
    url.searchParams.set("language", language);
  }

  if (timeRange) {
    url.searchParams.set("time_range", timeRange);
  }

  for (const plugin of enabledPlugins) {
    url.searchParams.append("enabled_plugins", plugin);
  }

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

  return {
    results: (payload.results ?? [])
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
        category: engine?.category ?? result.category ?? "uncategorized",
        domain,
        whitelisted: false,
        thumbnail: result.thumbnail,
        imgSrc: result.img_src,
        publishedDate: result.publishedDate ?? result.published_date,
        resultType: result.template ?? result.category,
      };
    }),
    meta: {
      pageno,
      numberOfResults: payload.number_of_results ?? null,
      suggestions: normalizeStringArray(payload.suggestions),
      answers: normalizeStringArray(payload.answers),
      corrections: normalizeStringArray(payload.corrections),
      infoboxes: payload.infoboxes ?? [],
      unresponsiveEngines: normalizeUnresponsiveEngines(payload.unresponsive_engines),
    } satisfies SearchMeta,
  };
}

function resolveEngineId(result: SearxngResult, engineById: Map<string, SearchEngine>) {
  const candidates = [result.engine, ...(result.engines ?? [])]
    .filter((engine): engine is string => Boolean(engine))
    .map((engine) => engine.toLowerCase());

  return candidates.find((engine) => engineById.has(engine)) ?? candidates[0] ?? "searxng";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeUnresponsiveEngines(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (Array.isArray(item)) {
      return item.filter((part) => typeof part === "string").join(": ");
    }

    if (typeof item === "string") {
      return item;
    }

    return JSON.stringify(item);
  });
}
