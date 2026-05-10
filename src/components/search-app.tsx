"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  Layers3,
  Loader2,
  Search,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
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

type RuleScopeId = "global" | `category:${string}` | `engine:${string}`;

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
  const [ruleScope, setRuleScope] = useState<RuleScopeId>("global");
  const [filterRules, setFilterRules] = useState<SearchFilterRules>({
    global: emptyRuleScope,
    categories: {},
    engines: {},
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/config");
        const nextConfig = (await response.json()) as ConfigResponse;

        setConfig(nextConfig);
        setEngines(nextConfig.engines);
        setSelectedEngines(nextConfig.engines.filter((engine) => engine.enabled).map((engine) => engine.id));
        setFilterRules({
          global: {
            whitelist: nextConfig.lists.whitelist,
            blacklist: nextConfig.lists.blacklist,
          },
          categories: {},
          engines: {},
        });
      } catch {
        toast.error("Could not load Searchtastic config.");
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();
  }, []);

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
  const currentRules = getRuleScope(filterRules, ruleScope);

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

  function toggleSearxngCategory(category: string) {
    setSelectedSearxngCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  function togglePlugin(plugin: string) {
    setEnabledPlugins((current) =>
      current.includes(plugin) ? current.filter((item) => item !== plugin) : [...current, plugin],
    );
  }

  function updateRules(kind: keyof DomainRuleScope, value: string) {
    const domains = parseDomainText(value);

    setFilterRules((current) => setRuleScopeRules(current, ruleScope, kind, domains));
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

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <Card className="rounded-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg font-medium tracking-tight">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                Search engines
              </CardTitle>
              <CardDescription>{selectedCount} of {engines.length || 0} selected</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingConfig ? (
                <LoadingRow label="Loading engines" />
              ) : (
                enginesByCategory.map(({ category, engines: categoryEngines }) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium capitalize">
                        <Layers3 className="size-3.5 text-muted-foreground" />
                        {category}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setCategoryEngines(category, true)}
                        >
                          All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setCategoryEngines(category, false)}
                        >
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
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg font-medium tracking-tight">
                <ShieldCheck className="size-4 text-muted-foreground" />
                Domain policy
              </CardTitle>
              <CardDescription>Blacklist always applies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-2 gap-2">
                <PolicyStat icon={ShieldCheck} label="Whitelist" value={config?.lists.whitelistCount ?? 0} />
                <PolicyStat icon={ShieldX} label="Blacklist" value={config?.lists.blacklistCount ?? 0} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg font-medium tracking-tight">
                <Filter className="size-4 text-muted-foreground" />
                Rule scope
              </CardTitle>
              <CardDescription>One domain per line</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={ruleScope}
                onChange={(event) => setRuleScope(event.target.value as RuleScopeId)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="global">Global rules</option>
                {categories.map((category) => (
                  <option key={category} value={`category:${category}`}>
                    Category: {category}
                  </option>
                ))}
                {engines.map((engine) => (
                  <option key={engine.id} value={`engine:${engine.id}`}>
                    Engine: {engine.name}
                  </option>
                ))}
              </select>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Whitelist</Label>
                <Textarea
                  value={(currentRules.whitelist ?? []).join("\n")}
                  onChange={(event) => updateRules("whitelist", event.target.value)}
                  placeholder="example.com"
                  className="min-h-24 resize-y font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Blacklist</Label>
                <Textarea
                  value={(currentRules.blacklist ?? []).join("\n")}
                  onChange={(event) => updateRules("blacklist", event.target.value)}
                  placeholder="spam.example"
                  className="min-h-24 resize-y font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
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
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search the web, or use !github / !science / :fr"
                      className="h-11 rounded-md pl-9 text-base"
                    />
                  </div>
                  <Button type="submit" disabled={!canSearch} className="h-11 min-w-28">
                    {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Search
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
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
                  <Label className="flex h-full min-h-14 items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm">
                    <span>Image proxy</span>
                    <Checkbox checked={imageProxy} onCheckedChange={(checked) => setImageProxy(Boolean(checked))} />
                  </Label>
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

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">SearXNG categories</div>
                <div className="flex flex-wrap gap-2">
                  {(config?.searxngCategories ?? []).map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={selectedSearxngCategories.includes(category) ? "secondary" : "outline"}
                      onClick={() => toggleSearxngCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Plugins</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {(config?.plugins ?? []).map((plugin) => (
                    <Label key={plugin} className="flex min-h-9 items-center justify-between rounded-md border px-3 text-xs">
                      <span>{plugin.replaceAll("_", " ")}</span>
                      <Checkbox checked={enabledPlugins.includes(plugin)} onCheckedChange={() => togglePlugin(plugin)} />
                    </Label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {!config?.searxngConfigured ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Set SEARXNG_URL before searching.
            </div>
          ) : null}

          {stats ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Received" value={stats.received} />
              <Stat label="Deduped" value={stats.deduped} />
              <Stat label="Blocked" value={stats.blacklisted} />
              <Stat label="Whitelist" value={stats.whitelistRemoved} />
              <Stat label="Shown" value={stats.shown} />
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
                  {results.map((result) => (
                    <article key={result.url} className="p-4 transition-colors hover:bg-muted/40">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={result.whitelisted ? "default" : "secondary"} className="gap-1.5">
                              {result.whitelisted ? <ShieldCheck className="size-3" /> : <Globe2 className="size-3" />}
                              {result.whitelisted ? "Whitelisted" : engineName(engines, result.engine)}
                            </Badge>
                            <span className="truncate font-mono text-xs text-muted-foreground">{result.domain}</span>
                            <span className="text-xs capitalize text-muted-foreground">{result.category}</span>
                          </div>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-base font-semibold leading-snug text-foreground hover:underline"
                          >
                            {result.title}
                          </a>
                          {result.content ? (
                            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{result.content}</p>
                          ) : null}
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
                          title="Open result"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
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
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
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

function parseDomainText(value: string) {
  return value
    .split(/[\n,]/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function getRuleScope(filterRules: SearchFilterRules, scopeId: RuleScopeId): DomainRuleScope {
  if (scopeId === "global") {
    return {
      whitelist: filterRules.global?.whitelist ?? [],
      blacklist: filterRules.global?.blacklist ?? [],
    };
  }

  const [scope, id] = splitScope(scopeId);
  const rules = scope === "category" ? filterRules.categories?.[id] : filterRules.engines?.[id];

  return {
    whitelist: rules?.whitelist ?? [],
    blacklist: rules?.blacklist ?? [],
  };
}

function setRuleScopeRules(
  filterRules: SearchFilterRules,
  scopeId: RuleScopeId,
  kind: keyof DomainRuleScope,
  domains: string[],
): SearchFilterRules {
  if (scopeId === "global") {
    return {
      ...filterRules,
      global: {
        whitelist: filterRules.global?.whitelist ?? [],
        blacklist: filterRules.global?.blacklist ?? [],
        [kind]: domains,
      },
    };
  }

  const [scope, id] = splitScope(scopeId);
  const key = scope === "category" ? "categories" : "engines";
  const currentScope = filterRules[key]?.[id] ?? emptyRuleScope;

  return {
    ...filterRules,
    [key]: {
      ...filterRules[key],
      [id]: {
        whitelist: currentScope.whitelist ?? [],
        blacklist: currentScope.blacklist ?? [],
        [kind]: domains,
      },
    },
  };
}

function splitScope(scopeId: Exclude<RuleScopeId, "global">) {
  const index = scopeId.indexOf(":");

  return [scopeId.slice(0, index), scopeId.slice(index + 1)] as ["category" | "engine", string];
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
