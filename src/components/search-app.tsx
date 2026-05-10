"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Filter,
  Layers3,
  Loader2,
  Search,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  DomainRuleScope,
  SearchEngine,
  SearchFilterRules,
  SearchMeta,
  SearchResult,
  SearchStats,
  SearchTimeRange,
  SafeSearchLevel,
  WhitelistMode,
} from "@/lib/search/types";

type ConfigResponse = {
  engines: SearchEngine[];
  categories: string[];
  searxngCategories: string[];
  languages: string[];
  plugins: string[];
  lists: {
    whitelist: string[];
    blacklist: string[];
    whitelistCount: number;
    blacklistCount: number;
  };
  searxngConfigured: boolean;
};

type SearchResponse = {
  results: SearchResult[];
  stats: SearchStats;
  meta: SearchMeta;
  error?: string;
};

const whitelistModes: Array<{ id: WhitelistMode; label: string }> = [
  { id: "off", label: "Off" },
  { id: "prefer", label: "Prefer" },
  { id: "only", label: "Only" },
];

type Lens = {
  id: string;
  name: string;
  engines: string[];
  categories: string[];
  language: string;
  timeRange: SearchTimeRange;
  safeSearch: SafeSearchLevel;
  plugins: string[];
  imageProxy: boolean;
  whitelistMode: WhitelistMode;
  filterRules: SearchFilterRules;
};

const LENSES_STORAGE_KEY = "searchtastic.lenses.v1";
const RULES_STORAGE_KEY = "searchtastic.filter-rules.v1";

const emptyRuleScope: DomainRuleScope = {
  whitelist: [],
  blacklist: [],
};

const timeRanges: Array<{ value: SearchTimeRange; label: string }> = [
  { value: "", label: "Any time" },
  { value: "day", label: "Past day" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

const safeSearchLevels: Array<{ value: SafeSearchLevel; label: string }> = [
  { value: "0", label: "Off" },
  { value: "1", label: "Moderate" },
  { value: "2", label: "Strict" },
];

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>([]);
  const [whitelistMode, setWhitelistMode] = useState<WhitelistMode>("prefer");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedSearxngCategories, setSelectedSearxngCategories] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [timeRange, setTimeRange] = useState<SearchTimeRange>("");
  const [safeSearch, setSafeSearch] = useState<SafeSearchLevel>("0");
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>(["Tracker_URL_remover", "Ahmia_blacklist"]);
  const [imageProxy, setImageProxy] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [savingLens, setSavingLens] = useState(false);
  const [newLensName, setNewLensName] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filterRules, setFilterRules] = useState<SearchFilterRules>({
    global: emptyRuleScope,
    categories: {},
    engines: {},
  });

  useEffect(() => {
    async function loadConfig() {
      let savedRules: SearchFilterRules | null = null;
      try {
        const raw = window.localStorage.getItem(RULES_STORAGE_KEY);
        if (raw) savedRules = JSON.parse(raw) as SearchFilterRules;
      } catch {
        savedRules = null;
      }

      try {
        const response = await fetch("/api/config");
        const nextConfig = (await response.json()) as ConfigResponse;

        setConfig(nextConfig);
        setEngines(nextConfig.engines);
        setSelectedEngines(nextConfig.engines.filter((engine) => engine.enabled).map((engine) => engine.id));
        setFilterRules(
          savedRules ?? {
            global: {
              whitelist: nextConfig.lists.whitelist,
              blacklist: nextConfig.lists.blacklist,
            },
            categories: {},
            engines: {},
          },
        );
      } catch {
        toast.error("Could not load Searchtastic config.");
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();
  }, []);

  useEffect(() => {
    if (loadingConfig) return;
    try {
      window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(filterRules));
    } catch {
      // localStorage unavailable — silently skip.
    }
  }, [filterRules, loadingConfig]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LENSES_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLenses(parsed as Lens[]);
      }
    } catch {
      // localStorage unavailable or corrupted — start fresh.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LENSES_STORAGE_KEY, JSON.stringify(lenses));
    } catch {
      // localStorage unavailable — silently skip.
    }
  }, [lenses]);

  useEffect(() => {
    function navigateResult(delta: number) {
      const articles = document.querySelectorAll<HTMLElement>("[data-result-index]");
      if (articles.length === 0) return;
      let currentIndex = -1;
      articles.forEach((article, idx) => {
        if (article.contains(document.activeElement)) currentIndex = idx;
      });
      const next =
        currentIndex < 0
          ? delta > 0
            ? 0
            : articles.length - 1
          : Math.max(0, Math.min(articles.length - 1, currentIndex + delta));
      const target = articles[next];
      if (!target) return;
      target.querySelector<HTMLAnchorElement>("a[href]")?.focus();
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        Boolean(target?.isContentEditable);

      if (event.key === "Escape" && target === searchInputRef.current) {
        searchInputRef.current?.blur();
        return;
      }

      if (inField) return;

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (event.key === "f") {
        event.preventDefault();
        setFiltersOpen(true);
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (event.key === "j") {
        event.preventDefault();
        navigateResult(1);
      } else if (event.key === "k") {
        event.preventDefault();
        navigateResult(-1);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!shortcutsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setShortcutsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsOpen]);

  const selectedCount = selectedEngines.length;
  const canSearch = query.trim().length > 0 && (selectedCount > 0 || selectedSearxngCategories.length > 0) && !searching;
  const categories = useMemo(() => [...new Set(engines.map((engine) => engine.category))], [engines]);
  const enginesByCategory = useMemo(
    () =>
      categories.map((category) => ({
        category,
        engines: engines.filter((engine) => engine.category === category),
      })),
    [categories, engines],
  );
  const listSummary = useMemo(() => {
    if (!config) {
      return "Lists unavailable";
    }

    return `${config.lists.whitelistCount} whitelist / ${config.lists.blacklistCount} blacklist`;
  }, [config]);

  function toggleEngine(engineId: string) {
    setSelectedEngines((current) =>
      current.includes(engineId) ? current.filter((id) => id !== engineId) : [...current, engineId],
    );
  }

  function setCategoryEngines(category: string, checked: boolean) {
    const categoryEngines = engines.filter((engine) => engine.category === category).map((engine) => engine.id);

    setSelectedEngines((current) => {
      if (!checked) {
        return current.filter((engine) => !categoryEngines.includes(engine));
      }

      return [...new Set([...current, ...categoryEngines])];
    });
  }

  function togglePlugin(plugin: string) {
    setEnabledPlugins((current) =>
      current.includes(plugin) ? current.filter((item) => item !== plugin) : [...current, plugin],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(1, false);
  }

  async function runSearch(nextPage: number, append: boolean) {
    if (!canSearch) {
      return;
    }

    setSearching(true);
    if (!append) {
      setStats(null);
      setMeta(null);
    }

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          engines: selectedEngines,
          categories: selectedSearxngCategories,
          whitelistMode,
          filterRules,
          language,
          pageno: nextPage,
          timeRange,
          safeSearch,
          enabledPlugins,
          imageProxy,
        }),
      });
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }

      setResults((current) => (append ? mergeResults(current, payload.results) : payload.results));
      setStats(payload.stats);
      setMeta(payload.meta);
      setPage(nextPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed.";
      if (!append) {
        setResults([]);
      }
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }

  const hasResults = results.length > 0;
  const bangTokens = useMemo(() => query.match(/(^|\s)(![^\s!]+|:[^\s]+)/g)?.map((token) => token.trim()) ?? [], [query]);
  const customRulesCount = useMemo(() => {
    const countScope = (scope?: { whitelist?: string[]; blacklist?: string[] }) =>
      (scope?.whitelist?.length ?? 0) + (scope?.blacklist?.length ?? 0);
    let total = countScope(filterRules.global);
    for (const value of Object.values(filterRules.categories ?? {})) total += countScope(value);
    for (const value of Object.values(filterRules.engines ?? {})) total += countScope(value);
    return total;
  }, [filterRules]);
  const timeRangeLabel = timeRanges.find((item) => item.value === timeRange)?.label ?? timeRange;
  const safeSearchLabel = safeSearchLevels.find((item) => item.value === safeSearch)?.label ?? safeSearch;
  const enginesPartial = engines.length > 0 && selectedEngines.length !== engines.length;
  const hasActiveFilters =
    enginesPartial ||
    Boolean(language) ||
    Boolean(timeRange) ||
    safeSearch !== "0" ||
    whitelistMode !== "off" ||
    !imageProxy ||
    customRulesCount > 0;

  const activeLensId = useMemo(() => {
    const sortJoin = (values: string[]) => [...values].sort().join(" ");
    const ruleJson = JSON.stringify(filterRules);
    const enginesKey = sortJoin(selectedEngines);
    const categoriesKey = sortJoin(selectedSearxngCategories);
    const pluginsKey = sortJoin(enabledPlugins);
    for (const lens of lenses) {
      if (
        sortJoin(lens.engines) === enginesKey &&
        sortJoin(lens.categories) === categoriesKey &&
        sortJoin(lens.plugins) === pluginsKey &&
        lens.language === language &&
        lens.timeRange === timeRange &&
        lens.safeSearch === safeSearch &&
        lens.imageProxy === imageProxy &&
        lens.whitelistMode === whitelistMode &&
        JSON.stringify(lens.filterRules) === ruleJson
      ) {
        return lens.id;
      }
    }
    return null;
  }, [
    lenses,
    selectedEngines,
    selectedSearxngCategories,
    enabledPlugins,
    language,
    timeRange,
    safeSearch,
    imageProxy,
    whitelistMode,
    filterRules,
  ]);

  function applyLens(lens: Lens) {
    setSelectedEngines(lens.engines);
    setSelectedSearxngCategories(lens.categories);
    setLanguage(lens.language);
    setTimeRange(lens.timeRange);
    setSafeSearch(lens.safeSearch);
    setEnabledPlugins(lens.plugins);
    setImageProxy(lens.imageProxy);
    setWhitelistMode(lens.whitelistMode);
    setFilterRules(lens.filterRules);
  }

  function saveLens() {
    const name = newLensName.trim();
    if (!name) {
      setSavingLens(false);
      setNewLensName("");
      return;
    }
    const lens: Lens = {
      id: crypto.randomUUID(),
      name,
      engines: selectedEngines,
      categories: selectedSearxngCategories,
      language,
      timeRange,
      safeSearch,
      plugins: enabledPlugins,
      imageProxy,
      whitelistMode,
      filterRules,
    };
    setLenses((prev) => [...prev, lens]);
    setNewLensName("");
    setSavingLens(false);
  }

  function deleteLens(id: string) {
    setLenses((prev) => prev.filter((lens) => lens.id !== id));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md border bg-primary text-primary-foreground">
              <Search className="size-4" />
            </div>
            <div>
              <div className="font-heading text-lg font-medium leading-none tracking-tight">Searchtastic</div>
              <div className="mt-1 text-xs text-muted-foreground">Filtered metasearch workspace</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant={config?.searxngConfigured ? "default" : "destructive"} className="gap-1.5">
              {config?.searxngConfigured ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
              {config?.searxngConfigured ? "Connected" : "Missing URL"}
            </Badge>
            <Badge variant="outline">{listSummary}</Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {lenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                onClick={() => applyLens(lens)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeLensId === lens.id
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {lens.name}
              </button>
            ))}
            {savingLens ? (
              <Input
                autoFocus
                value={newLensName}
                onChange={(event) => setNewLensName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveLens();
                  } else if (event.key === "Escape") {
                    setSavingLens(false);
                    setNewLensName("");
                  }
                }}
                onBlur={() => {
                  if (!newLensName.trim()) {
                    setSavingLens(false);
                  }
                }}
                placeholder="Lens name"
                className="h-7 w-36 rounded-full text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => setSavingLens(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                + Save as lens
              </button>
            )}
          </div>

          <Card className="rounded-md shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="font-heading text-lg font-medium tracking-tight">Search</CardTitle>
              <CardDescription>Results are merged, deduped, and filtered by domain.</CardDescription>
              <CardAction>
                <Badge variant="outline" className="gap-1.5">
                  <Filter className="size-3" />
                  {whitelistMode}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search the web, or use !github / !science / :fr"
                      className="h-11 rounded-md pl-9 text-base"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFiltersOpen(true)}
                      className="h-11"
                    >
                      <SlidersHorizontal className="size-4" />
                      Filters
                    </Button>
                    <Button type="submit" disabled={!canSearch} className="h-11 min-w-28">
                      {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      Search
                    </Button>
                  </div>
                </div>
              </form>

              {bangTokens.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                  <span className="font-medium text-muted-foreground">Bang syntax</span>
                  {bangTokens.map((token) => (
                    <Badge key={token} variant="secondary">
                      {token}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {enginesPartial ? (
                    <FilterChip onClick={() => setFiltersOpen(true)}>
                      {selectedEngines.length} engines
                    </FilterChip>
                  ) : null}
                  {language ? (
                    <FilterChip onClick={() => setFiltersOpen(true)}>{language}</FilterChip>
                  ) : null}
                  {timeRange ? (
                    <FilterChip onClick={() => setFiltersOpen(true)}>{timeRangeLabel}</FilterChip>
                  ) : null}
                  {safeSearch !== "0" ? (
                    <FilterChip onClick={() => setFiltersOpen(true)}>
                      Safe: {safeSearchLabel}
                    </FilterChip>
                  ) : null}
                  {whitelistMode !== "off" ? (
                    <FilterChip onClick={() => setFiltersOpen(true)}>
                      Whitelist: {whitelistMode}
                    </FilterChip>
                  ) : null}
                  {!imageProxy ? (
                    <FilterChip onClick={() => setFiltersOpen(true)}>No image proxy</FilterChip>
                  ) : null}
                  {customRulesCount > 0 ? (
                    <Link
                      href="/settings"
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {customRulesCount} custom rule{customRulesCount === 1 ? "" : "s"}
                    </Link>
                  ) : null}
                </div>
              ) : null}

            </CardContent>
          </Card>

          {(config?.searxngCategories ?? []).length > 0 ? (
            <div className="-mx-1 flex items-center gap-1 overflow-x-auto border-b">
              <CategoryTab
                active={selectedSearxngCategories.length === 0}
                onClick={() => setSelectedSearxngCategories([])}
              >
                All
              </CategoryTab>
              {(config?.searxngCategories ?? []).map((category) => {
                const active =
                  selectedSearxngCategories.length === 1 && selectedSearxngCategories[0] === category;
                return (
                  <CategoryTab
                    key={category}
                    active={active}
                    onClick={() => setSelectedSearxngCategories(active ? [] : [category])}
                  >
                    {category}
                  </CategoryTab>
                );
              })}
            </div>
          ) : null}

          {!config?.searxngConfigured ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Set SEARXNG_URL before searching.
            </div>
          ) : null}

          {stats ? (
            <div className="px-1 text-xs text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{stats.shown}</span>
              {" of "}
              <span className="tabular-nums">{stats.received}</span> results
              {stats.deduped > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">{stats.deduped}</span> deduped
                </>
              ) : null}
              {stats.blacklisted > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">{stats.blacklisted}</span> blocked
                </>
              ) : null}
              {stats.whitelistRemoved > 0 ? (
                <>
                  {" · "}
                  <span className="tabular-nums">{stats.whitelistRemoved}</span> off-whitelist
                </>
              ) : null}
            </div>
          ) : null}

          <Card className="min-h-[360px] rounded-md shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="font-heading text-lg font-medium tracking-tight">Results</CardTitle>
              <CardDescription>
                {stats ? `${results.length} results shown${meta?.numberOfResults ? ` of ${meta.numberOfResults}` : ""}` : "Ready for a search"}
              </CardDescription>
              <CardAction className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={!hasResults} onClick={() => downloadCsv(results)}>
                  <Download className="size-3.5" />
                  CSV
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!hasResults} onClick={() => downloadRss(results)}>
                  <Download className="size-3.5" />
                  RSS
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              {meta ? (
                <SearchMetaPanel
                  meta={meta}
                  onSuggestion={(suggestion) => {
                    setQuery(suggestion);
                    toast.info("Suggestion copied into the search box.");
                  }}
                />
              ) : null}

              {searching ? (
                <div className="space-y-3 p-4">
                  <ResultSkeleton />
                  <ResultSkeleton />
                  <ResultSkeleton />
                </div>
              ) : hasResults ? (
                <div className="divide-y">
                  {results.map((result, index) => (
                    <article
                      key={result.url}
                      data-result-index={index}
                      className="px-4 py-4 transition-colors hover:bg-muted/40 focus-within:bg-muted/60"
                    >
                      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://icons.duckduckgo.com/ip3/${result.domain}.ico`}
                            alt=""
                            loading="lazy"
                            className="size-4 shrink-0 rounded-sm"
                            onError={(event) => {
                              event.currentTarget.style.visibility = "hidden";
                            }}
                          />
                          <span className="truncate font-mono">{result.domain}</span>
                          {result.whitelisted ? (
                            <ShieldCheck
                              className="size-3 shrink-0 text-primary"
                              aria-label="Whitelisted"
                            />
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                          {engineName(engines, result.engine)}
                        </span>
                      </div>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 block font-heading text-lg font-medium leading-snug tracking-tight text-foreground hover:text-primary"
                      >
                        {result.title}
                      </a>
                      {result.content ? (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {result.content}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}

              {hasResults ? (
                <div className="border-t p-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={searching}
                    onClick={() => runSearch(page + 1, true)}
                    className="w-full"
                  >
                    {searching ? <Loader2 className="size-4 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Engines, language, time, plugins, and rules.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 pt-2">
            {lenses.length > 0 ? (
              <section className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Saved lenses
                </div>
                <div className="space-y-1">
                  {lenses.map((lens) => (
                    <div
                      key={lens.id}
                      className={cn(
                        "flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors",
                        activeLensId === lens.id && "border-primary/40 bg-primary/10",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => applyLens(lens)}
                        className="flex-1 text-left font-medium hover:text-primary"
                      >
                        {lens.name}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => deleteLens(lens.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Domain policy</div>
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-1">
                {whitelistModes.map((mode) => (
                  <Button
                    key={mode.id}
                    type="button"
                    size="sm"
                    variant={whitelistMode === mode.id ? "secondary" : "ghost"}
                    onClick={() => setWhitelistMode(mode.id)}
                    className="h-8"
                  >
                    {mode.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <PolicyStat icon={ShieldCheck} label="Whitelist" value={config?.lists.whitelistCount ?? 0} />
                <PolicyStat icon={ShieldX} label="Blacklist" value={config?.lists.blacklistCount ?? 0} />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Engines</div>
                <div className="text-xs text-muted-foreground">
                  {selectedCount} of {engines.length || 0}
                </div>
              </div>
              {loadingConfig ? (
                <LoadingRow label="Loading engines" />
              ) : (
                <div className="space-y-4">
                  {enginesByCategory.map(({ category, engines: categoryEngines }) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium capitalize">
                          <Layers3 className="size-3.5 text-muted-foreground" />
                          {category}
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="xs" onClick={() => setCategoryEngines(category, true)}>
                            All
                          </Button>
                          <Button type="button" variant="ghost" size="xs" onClick={() => setCategoryEngines(category, false)}>
                            None
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {categoryEngines.map((engine) => {
                          const checked = selectedEngines.includes(engine.id);
                          return (
                            <Label
                              key={engine.id}
                              className={cn(
                                "group flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/60",
                                checked && "border-foreground/20 bg-muted/40",
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <EngineDot active={checked} />
                                <span className="truncate font-medium">{engine.name}</span>
                              </span>
                              <Checkbox checked={checked} onCheckedChange={() => toggleEngine(engine.id)} />
                            </Label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search options</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Language">
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {(config?.languages ?? [""]).map((item) => (
                      <option key={item || "default"} value={item}>
                        {item || "Default"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Time">
                  <select
                    value={timeRange}
                    onChange={(event) => setTimeRange(event.target.value as SearchTimeRange)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {timeRanges.map((item) => (
                      <option key={item.value || "any"} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Safe search">
                  <select
                    value={safeSearch}
                    onChange={(event) => setSafeSearch(event.target.value as SafeSearchLevel)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {safeSearchLevels.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Label className="flex min-h-14 items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm">
                  <span>Image proxy</span>
                  <Checkbox
                    checked={imageProxy}
                    onCheckedChange={(checked) => setImageProxy(Boolean(checked))}
                  />
                </Label>
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plugins</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(config?.plugins ?? []).map((plugin) => (
                  <Label
                    key={plugin}
                    className="flex min-h-9 items-center justify-between rounded-md border px-3 text-xs"
                  >
                    <span>{plugin.replaceAll("_", " ")}</span>
                    <Checkbox
                      checked={enabledPlugins.includes(plugin)}
                      onCheckedChange={() => togglePlugin(plugin)}
                    />
                  </Label>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Domain rules</div>
              <Link
                href="/settings"
                onClick={() => setFiltersOpen(false)}
                className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <span>
                  {customRulesCount > 0
                    ? `${customRulesCount} custom rule${customRulesCount === 1 ? "" : "s"}`
                    : "Manage whitelists and blacklists"}
                </span>
                <span className="text-xs text-muted-foreground">Open settings →</span>
              </Link>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {shortcutsOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          onClick={() => setShortcutsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[1px]"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-md border bg-background p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="shortcuts-title"
                  className="font-heading text-lg font-medium tracking-tight"
                >
                  Keyboard shortcuts
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Press <Kbd>?</Kbd> any time to open this list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
              <dt><Kbd>/</Kbd></dt>
              <dd>Focus search</dd>
              <dt><Kbd>j</Kbd></dt>
              <dd>Next result</dd>
              <dt><Kbd>k</Kbd></dt>
              <dd>Previous result</dd>
              <dt><Kbd>Enter</Kbd></dt>
              <dd>Open focused result</dd>
              <dt><Kbd>f</Kbd></dt>
              <dd>Open filters</dd>
              <dt><Kbd>?</Kbd></dt>
              <dd>Show this help</dd>
              <dt><Kbd>Esc</Kbd></dt>
              <dd>Close panel or clear focus</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
      {children}
    </kbd>
  );
}

function CategoryTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative whitespace-nowrap px-3 py-2 text-sm font-medium capitalize transition-colors",
        active
          ? "text-foreground after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SearchMetaPanel({
  meta,
  onSuggestion,
}: {
  meta: SearchMeta;
  onSuggestion: (suggestion: string) => void;
}) {
  const hasMeta =
    meta.suggestions.length > 0 ||
    meta.answers.length > 0 ||
    meta.corrections.length > 0 ||
    meta.infoboxes.length > 0 ||
    meta.unresponsiveEngines.length > 0;

  if (!hasMeta) {
    return null;
  }

  return (
    <div className="space-y-2 border-b bg-muted/20 p-4 text-sm">
      {meta.answers.length > 0 ? (
        <div className="rounded-md border bg-background p-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Answers</div>
          <div className="space-y-1">
            {meta.answers.map((answer) => (
              <div key={answer}>{answer}</div>
            ))}
          </div>
        </div>
      ) : null}

      {meta.corrections.length > 0 ? (
        <MetaChips title="Corrections" items={meta.corrections} onClick={onSuggestion} />
      ) : null}

      {meta.suggestions.length > 0 ? (
        <MetaChips title="Suggestions" items={meta.suggestions} onClick={onSuggestion} />
      ) : null}

      {meta.unresponsiveEngines.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <div className="mb-1 text-xs font-medium">Unresponsive engines</div>
          <div className="flex flex-wrap gap-2">
            {meta.unresponsiveEngines.map((engine) => (
              <Badge key={engine} variant="outline">
                {engine}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetaChips({
  title,
  items,
  onClick,
}: {
  title: string;
  items: string[];
  onClick: (item: string) => void;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button key={item} type="button" variant="outline" size="sm" onClick={() => onClick(item)}>
            {item}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PolicyStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EngineDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full border",
        active ? "border-primary bg-primary" : "border-muted-foreground/40 bg-muted",
      )}
    />
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-3 rounded-md border bg-background p-4">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-5 w-3/4 rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
      <div className="grid size-12 place-items-center rounded-md border bg-muted">
        <Search className="size-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 font-heading text-lg font-medium tracking-tight">No results yet</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Choose engines, set a domain policy, and run a search.
      </p>
    </div>
  );
}

function engineName(engines: SearchEngine[], engineId: string) {
  return engines.find((engine) => engine.id === engineId)?.name ?? engineId;
}

function mergeResults(current: SearchResult[], next: SearchResult[]) {
  const seen = new Set(current.map((result) => result.url));

  return [...current, ...next.filter((result) => !seen.has(result.url))];
}

function downloadCsv(results: SearchResult[]) {
  const rows = [
    ["title", "url", "domain", "engine", "category", "whitelisted", "content"],
    ...results.map((result) => [
      result.title,
      result.url,
      result.domain,
      result.engine,
      result.category,
      String(result.whitelisted),
      result.content,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  downloadText("searchtastic-results.csv", "text/csv;charset=utf-8", csv);
}

function downloadRss(results: SearchResult[]) {
  const items = results
    .map(
      (result) => `<item>
  <title>${escapeXml(result.title)}</title>
  <link>${escapeXml(result.url)}</link>
  <description>${escapeXml(result.content)}</description>
  <source>${escapeXml(result.engine)}</source>
</item>`,
    )
    .join("\n");
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Searchtastic filtered results</title>
<link>https://searchtastic-web-production.up.railway.app</link>
<description>Filtered Searchtastic results</description>
${items}
</channel>
</rss>`;

  downloadText("searchtastic-results.rss", "application/rss+xml;charset=utf-8", rss);
}

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function downloadText(fileName: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
