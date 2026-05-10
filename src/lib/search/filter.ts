import type { SearchFilterRules, SearchResult, WhitelistMode } from "@/lib/search/types";

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function domainMatches(domain: string, rules: string[]) {
  if (!domain) {
    return false;
  }

  return rules.some((rule) => domain === rule || domain.endsWith(`.${rule}`));
}

export function normalizeDomainList(rules: unknown) {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .filter((rule): rule is string => typeof rule === "string")
    .flatMap((rule) => rule.split(/[\n,]/))
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .map((rule) => rule.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
    .filter(Boolean);
}

export function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

export function filterResults({
  results,
  baseWhitelist,
  baseBlacklist,
  filterRules,
  whitelistMode,
}: {
  results: SearchResult[];
  baseWhitelist: string[];
  baseBlacklist: string[];
  filterRules: SearchFilterRules;
  whitelistMode: WhitelistMode;
}) {
  const seen = new Set<string>();
  let blacklisted = 0;
  let whitelistRemoved = 0;

  const deduped = results.filter((result) => {
    const key = normalizeUrl(result.url);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  const allowed = deduped.map((result) => {
    const whitelist = rulesForResult(result, filterRules, "whitelist", baseWhitelist);
    const blacklist = rulesForResult(result, filterRules, "blacklist", baseBlacklist);

    return {
      ...result,
      whitelisted: domainMatches(result.domain, whitelist),
      blocked: domainMatches(result.domain, blacklist),
    };
  }).filter((result) => {
    if (result.blocked) {
      blacklisted += 1;
      return false;
    }

    if (whitelistMode === "only" && !result.whitelisted) {
      whitelistRemoved += 1;
      return false;
    }

    return true;
  });

  if (whitelistMode === "prefer") {
    allowed.sort((a, b) => Number(b.whitelisted) - Number(a.whitelisted));
  }
  const visibleResults = allowed.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    engine: result.engine,
    category: result.category,
    domain: result.domain,
    whitelisted: result.whitelisted,
    thumbnail: result.thumbnail,
    imgSrc: result.imgSrc,
    publishedDate: result.publishedDate,
    resultType: result.resultType,
  }));

  return {
    results: visibleResults,
    stats: {
      received: results.length,
      deduped: results.length - deduped.length,
      blacklisted,
      whitelistRemoved,
      shown: visibleResults.length,
    },
  };
}

function rulesForResult(
  result: SearchResult,
  filterRules: SearchFilterRules,
  kind: "whitelist" | "blacklist",
  baseRules: string[],
) {
  return [
    ...baseRules,
    ...normalizeDomainList(filterRules.global?.[kind]),
    ...normalizeDomainList(filterRules.categories?.[result.category]?.[kind]),
    ...normalizeDomainList(filterRules.engines?.[result.engine]?.[kind]),
  ];
}
