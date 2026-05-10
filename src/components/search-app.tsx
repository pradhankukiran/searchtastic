"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Searchtastic</p>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">Filtered metasearch</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge variant={config?.searxngConfigured ? "default" : "destructive"}>
              {config?.searxngConfigured ? "SearXNG connected" : "SearXNG missing"}
            </Badge>
            <Badge variant="outline">{listSummary}</Badge>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <SlidersHorizontal className="size-4 text-emerald-700" />
              Sources
            </div>

            <div className="mt-4 space-y-3">
              {loadingConfig ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Loading engines
                </div>
              ) : (
                engines.map((engine) => (
                  <Label
                    key={engine.id}
                    className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    <span>{engine.name}</span>
                    <Checkbox
                      checked={selectedEngines.includes(engine.id)}
                      onCheckedChange={() => toggleEngine(engine.id)}
                    />
                  </Label>
                ))
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="size-4 text-emerald-700" />
              Whitelist
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {whitelistModes.map((mode) => (
                <Button
                  key={mode.id}
                  type="button"
                  size="sm"
                  variant={whitelistMode === mode.id ? "default" : "outline"}
                  onClick={() => setWhitelistMode(mode.id)}
                  className="h-9"
                >
                  {mode.label}
                </Button>
              ))}
            </div>

            <div className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-950">
              <div className="flex items-center gap-2 font-medium">
                <Filter className="size-4" />
                {selectedCount} selected
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search the web"
                    className="h-11 pl-9 text-base"
                  />
                </div>
                <Button type="submit" disabled={!canSearch} className="h-11 min-w-28">
                  {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Search
                </Button>
              </div>
            </form>

            {stats ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="Received" value={stats.received} />
                <Stat label="Deduped" value={stats.deduped} />
                <Stat label="Blocked" value={stats.blacklisted} />
                <Stat label="Whitelist" value={stats.whitelistRemoved} />
                <Stat label="Shown" value={stats.shown} />
              </div>
            ) : null}

            {!config?.searxngConfigured ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                Set SEARXNG_URL before searching.
              </div>
            ) : null}

            <section className="space-y-3">
              {results.map((result) => (
                <Card key={result.url} className="rounded-lg border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={result.whitelisted ? "default" : "secondary"}>
                            {result.whitelisted ? "Whitelisted" : result.engine}
                          </Badge>
                          <span className="truncate text-sm text-slate-500">{result.domain}</span>
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-lg font-semibold leading-snug text-slate-950 hover:text-emerald-700"
                        >
                          {result.title}
                        </a>
                        {result.content ? <p className="line-clamp-3 text-sm leading-6 text-slate-600">{result.content}</p> : null}
                      </div>
                      <Button asChild variant="outline" size="icon" className="shrink-0" title="Open result">
                        <a href={result.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
    </div>
  );
}
