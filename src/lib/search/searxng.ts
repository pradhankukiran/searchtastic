import { getDomain, domainMatches } from "@/lib/search/filter";
import type { SearchResult } from "@/lib/search/types";

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
  whitelist,
}: {
  query: string;
  engines: string[];
  whitelist: string[];
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

  return (payload.results ?? [])
    .filter((result): result is Required<Pick<SearxngResult, "title" | "url">> & SearxngResult =>
      Boolean(result.title && result.url),
    )
    .map<SearchResult>((result) => {
      const domain = getDomain(result.url);

      return {
        title: result.title,
        url: result.url,
        content: result.content ?? "",
        engine: result.engine ?? result.engines?.join(", ") ?? "searxng",
        domain,
        whitelisted: domainMatches(domain, whitelist),
      };
    });
}
