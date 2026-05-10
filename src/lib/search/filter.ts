import type { SearchResult, WhitelistMode } from "@/lib/search/types";

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
  blacklist,
  whitelistMode,
}: {
  results: SearchResult[];
  blacklist: string[];
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

  const allowed = deduped.filter((result) => {
    if (domainMatches(result.domain, blacklist)) {
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

  return {
    results: allowed,
    stats: {
      received: results.length,
      deduped: results.length - deduped.length,
      blacklisted,
      whitelistRemoved,
      shown: allowed.length,
    },
  };
}
