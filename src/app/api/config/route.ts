import { NextResponse } from "next/server";

import { readDomainList, readSearchEngines } from "@/lib/search/config";

export const runtime = "nodejs";

export async function GET() {
  const [engines, whitelist, blacklist] = await Promise.all([
    readSearchEngines(),
    readDomainList("whitelist.txt"),
    readDomainList("blacklist.txt"),
  ]);

  return NextResponse.json({
    engines,
    categories: [...new Set(engines.map((engine) => engine.category))],
    searxngCategories: ["general", "images", "videos", "news", "map", "music", "it", "science", "files", "social media"],
    languages: ["", "all", "en", "en-US", "de", "fr", "es", "hi"],
    plugins: [
      "Tracker_URL_remover",
      "Ahmia_blacklist",
      "Open_Access_DOI_rewrite",
      "Hostnames_plugin",
      "Hash_plugin",
      "Self_Information",
      "Tor_check_plugin",
    ],
    lists: {
      whitelist,
      blacklist,
      whitelistCount: whitelist.length,
      blacklistCount: blacklist.length,
    },
    searxngConfigured: Boolean(process.env.SEARXNG_URL),
  });
}
