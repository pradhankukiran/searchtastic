import { NextResponse } from "next/server";

import { readDomainList, readSearchEngines } from "@/lib/search/config";
import { filterResults, normalizeDomainList } from "@/lib/search/filter";
import { searchSearxng } from "@/lib/search/searxng";
import type {
  SafeSearchLevel,
  SearchFilterRules,
  SearchRequest,
  SearchTimeRange,
  WhitelistMode,
} from "@/lib/search/types";

export const runtime = "nodejs";

const whitelistModes = new Set<WhitelistMode>(["off", "prefer", "only"]);
const timeRanges = new Set<SearchTimeRange>(["", "day", "month", "year"]);
const safeSearchLevels = new Set<SafeSearchLevel>(["0", "1", "2"]);
const supportedPlugins = new Set([
  "Hash_plugin",
  "Self_Information",
  "Tracker_URL_remover",
  "Ahmia_blacklist",
  "Hostnames_plugin",
  "Open_Access_DOI_rewrite",
  "Tor_check_plugin",
]);

export async function POST(request: Request) {
  let body: Partial<SearchRequest>;

  try {
    body = (await request.json()) as Partial<SearchRequest>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const query = body.query?.trim();
  const requestedEngines = Array.isArray(body.engines) ? body.engines : [];
  const requestedCategories = Array.isArray(body.categories) ? body.categories : [];
  const whitelistMode = whitelistModes.has(body.whitelistMode as WhitelistMode)
    ? (body.whitelistMode as WhitelistMode)
    : "prefer";
  const pageno = clampPage(body.pageno);
  const timeRange = timeRanges.has(body.timeRange as SearchTimeRange) ? (body.timeRange as SearchTimeRange) : "";
  const safeSearch = safeSearchLevels.has(body.safeSearch as SafeSearchLevel)
    ? (body.safeSearch as SafeSearchLevel)
    : "0";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const enabledPlugins = sanitizePlugins(body.enabledPlugins);
  const imageProxy = body.imageProxy !== false;

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
  const categories = requestedCategories.filter((category): category is string => typeof category === "string");
  const filterRules = sanitizeFilterRules(body.filterRules, configuredEngines.map((engine) => engine.category), engines);

  if (engines.length === 0 && categories.length === 0) {
    return NextResponse.json({ error: "Select at least one engine or SearXNG category." }, { status: 400 });
  }

  try {
    const search = await searchSearxng({
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
    });
    const filtered = filterResults({
      results: search.results,
      baseWhitelist: whitelist,
      baseBlacklist: blacklist,
      filterRules,
      whitelistMode,
    });

    return NextResponse.json({
      query,
      engines,
      categories,
      whitelistMode,
      language,
      pageno,
      timeRange,
      safeSearch,
      enabledPlugins,
      imageProxy,
      filterRules,
      results: filtered.results,
      stats: filtered.stats,
      meta: search.meta,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function clampPage(pageno: unknown) {
  const page = typeof pageno === "number" ? pageno : Number(pageno);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return Math.min(page, 20);
}

function sanitizePlugins(plugins: unknown) {
  if (!Array.isArray(plugins)) {
    return ["Tracker_URL_remover", "Ahmia_blacklist"];
  }

  return plugins.filter((plugin): plugin is string => typeof plugin === "string" && supportedPlugins.has(plugin));
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
