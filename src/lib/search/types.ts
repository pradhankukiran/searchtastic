export type SearchEngine = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
};

export type WhitelistMode = "off" | "prefer" | "only";

export type DomainRuleScope = {
  whitelist: string[];
  blacklist: string[];
};

export type SearchFilterRules = {
  global?: Partial<DomainRuleScope>;
  categories?: Record<string, Partial<DomainRuleScope>>;
  engines?: Record<string, Partial<DomainRuleScope>>;
};

export type SearchRequest = {
  query: string;
  engines: string[];
  whitelistMode: WhitelistMode;
  filterRules?: SearchFilterRules;
};

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  engine: string;
  category: string;
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
