export type SearchEngine = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
};

export type WhitelistMode = "off" | "prefer" | "only";
export type SearchTimeRange = "day" | "month" | "year" | "";
export type SafeSearchLevel = "0" | "1" | "2";

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
  categories?: string[];
  whitelistMode: WhitelistMode;
  filterRules?: SearchFilterRules;
  language?: string;
  pageno?: number;
  timeRange?: SearchTimeRange;
  safeSearch?: SafeSearchLevel;
  enabledPlugins?: string[];
  imageProxy?: boolean;
};

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  engine: string;
  category: string;
  domain: string;
  whitelisted: boolean;
  thumbnail?: string;
  imgSrc?: string;
  publishedDate?: string;
  resultType?: string;
};

export type SearchStats = {
  received: number;
  deduped: number;
  blacklisted: number;
  whitelistRemoved: number;
  shown: number;
};

export type SearchMeta = {
  pageno: number;
  numberOfResults: number | null;
  suggestions: string[];
  answers: string[];
  corrections: string[];
  infoboxes: unknown[];
  unresponsiveEngines: string[];
};
