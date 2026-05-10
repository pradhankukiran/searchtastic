import { NextResponse } from "next/server";

import { readDomainList, readSearchEngines } from "@/lib/search/config";
import { filterResults, normalizeDomainList } from "@/lib/search/filter";
import { searchSearxng } from "@/lib/search/searxng";
import type { SearchFilterRules, SearchRequest, WhitelistMode } from "@/lib/search/types";

export const runtime = "nodejs";

const whitelistModes = new Set<WhitelistMode>(["off", "prefer", "only"]);

export async function POST(request: Request) {
  let body: Partial<SearchRequest>;

  try {
    body = (await request.json()) as Partial<SearchRequest>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const query = body.query?.trim();
  const requestedEngines = Array.isArray(body.engines) ? body.engines : [];
  const whitelistMode = whitelistModes.has(body.whitelistMode as WhitelistMode)
    ? (body.whitelistMode as WhitelistMode)
    : "prefer";

  if (!query) {
    return NextResponse.json({ error: "Search query is required." }, { status: 400 });
  }

  const [configuredEngines, whitelist, blacklist] = await Promise.all([
    readSearchEngines(),
    readDomainList("whitelist.txt"),
    readDomainList("blacklist.txt"),
  ]);

  const allowedEngineIds = new Set(configuredEngines.map((engine) => engine.id));
  const engines = requestedEngines.filter((engine) => allowedEngineIds.has(engine));
  const filterRules = sanitizeFilterRules(body.filterRules, configuredEngines.map((engine) => engine.category), engines);

  if (engines.length === 0) {
    return NextResponse.json({ error: "Select at least one configured search engine." }, { status: 400 });
  }

  try {
    const rawResults = await searchSearxng({ query, engines, configuredEngines });
    const filtered = filterResults({
      results: rawResults,
      baseWhitelist: whitelist,
      baseBlacklist: blacklist,
      filterRules,
      whitelistMode,
    });

    return NextResponse.json({
      query,
      engines,
      whitelistMode,
      filterRules,
      results: filtered.results,
      stats: filtered.stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function sanitizeFilterRules(
  rules: SearchFilterRules | undefined,
  configuredCategories: string[],
  selectedEngines: string[],
): SearchFilterRules {
  const categorySet = new Set(configuredCategories);
  const engineSet = new Set(selectedEngines);

  return {
    global: sanitizeScope(rules?.global),
    categories: Object.fromEntries(
      Object.entries(rules?.categories ?? {})
        .filter(([category]) => categorySet.has(category))
        .map(([category, scope]) => [category, sanitizeScope(scope)]),
    ),
    engines: Object.fromEntries(
      Object.entries(rules?.engines ?? {})
        .filter(([engine]) => engineSet.has(engine))
        .map(([engine, scope]) => [engine, sanitizeScope(scope)]),
    ),
  };
}

function sanitizeScope(scope: SearchFilterRules["global"]) {
  return {
    whitelist: normalizeDomainList(scope?.whitelist),
    blacklist: normalizeDomainList(scope?.blacklist),
  };
}
