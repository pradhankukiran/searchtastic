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
    lists: {
      whitelistCount: whitelist.length,
      blacklistCount: blacklist.length,
    },
    searxngConfigured: Boolean(process.env.SEARXNG_URL),
  });
}
