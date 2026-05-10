export type SearchEngine = {
  id: string;
  name: string;
  enabled: boolean;
};

export type WhitelistMode = "off" | "prefer" | "only";

export type SearchRequest = {
  query: string;
  engines: string[];
  whitelistMode: WhitelistMode;
};

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  engine: string;
  domain: string;
  whitelisted: boolean;
};

export type SearchStats = {
  received: number;
  deduped: number;
  blacklisted: number;
  whitelistRemoved: number;
  shown: number;
};
