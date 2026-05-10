"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Download,
  Layers3,
  Loader2,
  Search,
  Settings,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DomainRulesEditor } from "@/components/domain-rules-editor";
import { useAppConfig } from "@/lib/search/config-context";
import { cn } from "@/lib/utils";
import type {
  SearchFilterRules,
  SearchMeta,
  SearchResult,
  SearchStats,
  SearchTimeRange,
  SafeSearchLevel,
  WhitelistMode,
} from "@/lib/search/types";

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
  const config = useAppConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const engines = config.engines;
  const [query, setQuery] = useState(urlQuery);
  const lastUrlQuery = useRef("");
  const [selectedEngines, setSelectedEngines] = useState<string[]>(() =>
    config.engines.filter((engine) => engine.enabled).map((engine) => engine.id),
  );
  const [whitelistMode, setWhitelistMode] = useState<WhitelistMode>("prefer");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedSearxngCategories, setSelectedSearxngCategories] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [timeRange, setTimeRange] = useState<SearchTimeRange>("");
  const [safeSearch, setSafeSearch] = useState<SafeSearchLevel>("0");
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>(["Tracker_URL_remover", "Ahmia_blacklist"]);
  const [imageProxy, setImageProxy] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [savingLens, setSavingLens] = useState(false);
  const [newLensName, setNewLensName] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lensesHydrated = useRef(false);
  const rulesHydrated = useRef(false);
  const [filterRules, setFilterRules] = useState<SearchFilterRules>(() => ({
    global: {
      whitelist: config.lists.whitelist,
      blacklist: config.lists.blacklist,
    },
    categories: {},
    engines: {},
  }));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RULES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SearchFilterRules;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilterRules(parsed);
      }
    } catch {
      // localStorage unavailable or corrupted — keep defaults.
    } finally {
      rulesHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!rulesHydrated.current) return;
    try {
      window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(filterRules));
    } catch {
      // localStorage unavailable — silently skip.
    }
  }, [filterRules]);

  useEffect(() => {
    if (urlQuery === lastUrlQuery.current) return;
    lastUrlQuery.current = urlQuery;
    if (!urlQuery) {
      // Back-button or direct visit to "/" — clear hero.
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuery("");
      setResults([]);
      setStats(null);
      setMeta(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    // Direct visit, forward-button, or paste of /?q=... — sync and search.
    setQuery(urlQuery);
    runSearch(1, false, { query: urlQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LENSES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLenses(parsed as Lens[]);
        }
      }
    } catch {
      // localStorage unavailable or corrupted — start fresh.
    } finally {
      lensesHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!lensesHydrated.current) return;
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
    const trimmed = query.trim();
    if (trimmed) {
      lastUrlQuery.current = trimmed;
      const params = new URLSearchParams();
      params.set("q", trimmed);
      router.push(`/?${params.toString()}`, { scroll: false });
    }
    await runSearch(1, false);
  }

  async function runSearch(
    nextPage: number,
    append: boolean,
    overrides?: { query?: string; categories?: string[] },
  ) {
    const targetQuery = (overrides?.query ?? query).trim();
    const targetCategories = overrides?.categories ?? selectedSearxngCategories;
    if (!targetQuery || (selectedEngines.length === 0 && targetCategories.length === 0) || searching) {
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
          query: targetQuery,
          engines: selectedEngines,
          categories: targetCategories,
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
  const hasSearched = stats !== null || searching;
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

  const lensSignatures = useMemo(() => {
    const sortJoin = (values: string[]) => [...values].sort().join(" ");
    return lenses.map((lens) => ({
      id: lens.id,
      engines: sortJoin(lens.engines),
      categories: sortJoin(lens.categories),
      plugins: sortJoin(lens.plugins),
      language: lens.language,
      timeRange: lens.timeRange,
      safeSearch: lens.safeSearch,
      imageProxy: lens.imageProxy,
      whitelistMode: lens.whitelistMode,
      rulesJson: JSON.stringify(lens.filterRules),
    }));
  }, [lenses]);

  const activeLensId = useMemo(() => {
    if (lensSignatures.length === 0) return null;
    const sortJoin = (values: string[]) => [...values].sort().join(" ");
    const enginesKey = sortJoin(selectedEngines);
    const categoriesKey = sortJoin(selectedSearxngCategories);
    const pluginsKey = sortJoin(enabledPlugins);
    const ruleJson = JSON.stringify(filterRules);
    for (const sig of lensSignatures) {
      if (
        sig.engines === enginesKey &&
        sig.categories === categoriesKey &&
        sig.plugins === pluginsKey &&
        sig.language === language &&
        sig.timeRange === timeRange &&
        sig.safeSearch === safeSearch &&
        sig.imageProxy === imageProxy &&
        sig.whitelistMode === whitelistMode &&
        sig.rulesJson === ruleJson
      ) {
        return sig.id;
      }
    }
    return null;
  }, [
    lensSignatures,
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

  const engineNameById = useMemo(
    () => new Map(engines.map((engine) => [engine.id, engine.name])),
    [engines],
  );

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
    <>
      {!hasSearched ? (
        <div className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center px-4 pb-20 sm:px-6">
          <div className="w-full max-w-3xl space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="font-heading text-5xl font-medium tracking-tight">Searchtastic</h1>
              <p className="text-sm text-muted-foreground">A filtered metasearch.</p>
            </div>

            <form onSubmit={onSubmit}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search the web, or use !github / :fr"
                    className="h-14 rounded-md pl-12 text-base"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFiltersOpen(true)}
                    className="h-14"
                  >
                    <SlidersHorizontal className="size-4" />
                    Filters
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                    className="h-14 w-14"
                    aria-label="Settings"
                  >
                    <Settings className="size-4" />
                  </Button>
                  <Button type="submit" disabled={!canSearch} className="h-14 min-w-28">
                    {searching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    Search
                  </Button>
                </div>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-center gap-2">
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

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
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
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {customRulesCount} custom rule{customRulesCount === 1 ? "" : "s"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {!config?.searxngConfigured ? (
              <div className="mx-auto flex max-w-md items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                Set SEARXNG_URL before searching.
              </div>
            ) : null}

            <p className="text-center text-xs text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 font-mono">/</kbd> to focus,{" "}
              <kbd className="rounded border bg-muted px-1 font-mono">?</kbd> for shortcuts.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="sticky top-14 z-10 border-b bg-background">
            <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-3 sm:px-6 lg:px-8">
              <form onSubmit={onSubmit}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search…"
                      className="h-11 rounded-md pl-9 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFiltersOpen(true)}
                    className="h-11"
                    aria-label="Filters"
                  >
                    <SlidersHorizontal className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSettingsOpen(true)}
                    className="h-11"
                    aria-label="Settings"
                  >
                    <Settings className="size-4" />
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canSearch}
                    className="h-11"
                    aria-label="Search"
                  >
                    {searching ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </Button>
                </div>
              </form>

              {bangTokens.length > 0 || hasActiveFilters || lenses.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {lenses.map((lens) => (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => applyLens(lens)}
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 font-medium transition-colors",
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
                      className="h-6 w-32 rounded-full text-xs"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSavingLens(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed bg-background px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      + Save lens
                    </button>
                  )}
                  {bangTokens.map((token) => (
                    <span
                      key={token}
                      className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 font-mono text-muted-foreground"
                    >
                      {token}
                    </span>
                  ))}
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
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {customRulesCount} custom rule{customRulesCount === 1 ? "" : "s"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
            {(config?.searxngCategories ?? []).length > 0 ? (
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b">
                <CategoryTab
                  active={selectedSearxngCategories.length === 0}
                  onClick={() => {
                    setSelectedSearxngCategories([]);
                    if (hasSearched) runSearch(1, false, { categories: [] });
                  }}
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
                      onClick={() => {
                        const next = active ? [] : [category];
                        setSelectedSearxngCategories(next);
                        if (hasSearched) runSearch(1, false, { categories: next });
                      }}
                    >
                      {category}
                    </CategoryTab>
                  );
                })}
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

            <div>
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
                <div className="space-y-3">
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
                      className="-mx-4 px-4 py-5 transition-colors hover:bg-muted/40 focus-within:bg-muted/60"
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
                        <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground/80">
                          {engineNameById.get(result.engine) ?? result.engine}
                        </span>
                      </div>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 block font-heading text-xl font-medium leading-snug tracking-tight text-foreground hover:text-primary"
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
                <div className="flex flex-col items-center gap-3 border-t pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={searching}
                    onClick={() => runSearch(page + 1, true)}
                  >
                    {searching ? <Loader2 className="size-4 animate-spin" /> : null}
                    Load more
                  </Button>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => downloadCsv(results)}
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      <Download className="size-3" />
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadRss(results)}
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      <Download className="size-3" />
                      RSS
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

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
              <button
                type="button"
                onClick={() => {
                  setFiltersOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span>
                  {customRulesCount > 0
                    ? `${customRulesCount} custom rule${customRulesCount === 1 ? "" : "s"}`
                    : "Manage whitelists and blacklists"}
                </span>
                <span className="text-xs text-muted-foreground">Open →</span>
              </button>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <Modal open={settingsOpen} onOpenChange={setSettingsOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Settings</ModalTitle>
            <ModalDescription>
              Domain whitelists and blacklists, scoped globally or per category/engine.
            </ModalDescription>
          </ModalHeader>
          <DomainRulesEditor />
        </ModalContent>
      </Modal>

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
    </>
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
          ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary"
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
    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
      <h2 className="font-heading text-lg font-medium tracking-tight">No matches</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Try a different query, broaden the engines, or relax your domain rules.
      </p>
    </div>
  );
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
