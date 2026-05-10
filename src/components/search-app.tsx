"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe2,
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
import { cn } from "@/lib/utils";
import type { SearchEngine, SearchResult, SearchStats, WhitelistMode } from "@/lib/search/types";

type ConfigResponse = {
  engines: SearchEngine[];
  lists: {
    whitelistCount: number;
    blacklistCount: number;
  };
  searxngConfigured: boolean;
};

type SearchResponse = {
  results: SearchResult[];
  stats: SearchStats;
  error?: string;
};

const whitelistModes: Array<{ id: WhitelistMode; label: string }> = [
  { id: "off", label: "Off" },
  { id: "prefer", label: "Prefer" },
  { id: "only", label: "Only" },
];

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>([]);
  const [whitelistMode, setWhitelistMode] = useState<WhitelistMode>("prefer");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/config");
        const nextConfig = (await response.json()) as ConfigResponse;

        setConfig(nextConfig);
        setEngines(nextConfig.engines);
        setSelectedEngines(nextConfig.engines.filter((engine) => engine.enabled).map((engine) => engine.id));
      } catch {
        toast.error("Could not load Searchtastic config.");
      } finally {
        setLoadingConfig(false);
      }
    }

    loadConfig();
  }, []);

  const selectedCount = selectedEngines.length;
  const canSearch = query.trim().length > 0 && selectedCount > 0 && !searching;

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSearch) {
      return;
    }

    setSearching(true);
    setStats(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          engines: selectedEngines,
          whitelistMode,
        }),
      });
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }

      setResults(payload.results);
      setStats(payload.stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed.";
      setResults([]);
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }

  const hasResults = results.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md border bg-primary text-primary-foreground">
              <Search className="size-4" />
            </div>
            <div>
              <div className="text-base font-semibold leading-none">Searchtastic</div>
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
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                Search engines
              </CardTitle>
              <CardDescription>{selectedCount} of {engines.length || 0} selected</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingConfig ? (
                <LoadingRow label="Loading engines" />
              ) : (
                engines.map((engine) => {
                  const checked = selectedEngines.includes(engine.id);

                  return (
                    <Label
                      key={engine.id}
                      className={cn(
                        "group flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/60",
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
                })
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
        </aside>

        <section className="space-y-4">
          <Card className="rounded-md shadow-sm">
            <CardHeader className="border-b">
              <CardTitle>Search</CardTitle>
              <CardDescription>Results are merged, deduped, and filtered by domain.</CardDescription>
              <CardAction>
                <Badge variant="outline" className="gap-1.5">
                  <Filter className="size-3" />
                  {whitelistMode}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search the web"
                    className="h-11 rounded-md pl-9 text-base"
                  />
                </div>
                <Button type="submit" disabled={!canSearch} className="h-11 min-w-28">
                  {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Search
                </Button>
              </form>
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
              <CardTitle>Results</CardTitle>
              <CardDescription>{stats ? `${stats.shown} results shown` : "Ready for a search"}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
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
                              {result.whitelisted ? "Whitelisted" : result.engine}
                            </Badge>
                            <span className="truncate font-mono text-xs text-muted-foreground">{result.domain}</span>
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
      <h2 className="mt-4 text-base font-semibold">No results yet</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Choose engines, set a domain policy, and run a search.
      </p>
    </div>
  );
}
