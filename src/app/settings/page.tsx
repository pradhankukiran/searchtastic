"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  DomainRuleScope,
  SearchEngine,
  SearchFilterRules,
} from "@/lib/search/types";

type RuleScopeId = "global" | `category:${string}` | `engine:${string}`;

type ConfigResponse = {
  engines: SearchEngine[];
  categories: string[];
  lists: {
    whitelist: string[];
    blacklist: string[];
    whitelistCount: number;
    blacklistCount: number;
  };
};

const RULES_STORAGE_KEY = "searchtastic.filter-rules.v1";

const emptyRuleScope: DomainRuleScope = { whitelist: [], blacklist: [] };

function parseDomainText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readScope(rules: SearchFilterRules, scopeId: RuleScopeId): DomainRuleScope {
  if (scopeId === "global") {
    return {
      whitelist: rules.global?.whitelist ?? [],
      blacklist: rules.global?.blacklist ?? [],
    };
  }
  const separator = scopeId.indexOf(":");
  const scope = scopeId.slice(0, separator) as "category" | "engine";
  const id = scopeId.slice(separator + 1);
  const target = scope === "category" ? rules.categories?.[id] : rules.engines?.[id];
  return {
    whitelist: target?.whitelist ?? [],
    blacklist: target?.blacklist ?? [],
  };
}

function writeScope(
  rules: SearchFilterRules,
  scopeId: RuleScopeId,
  kind: "whitelist" | "blacklist",
  values: string[],
): SearchFilterRules {
  if (scopeId === "global") {
    return {
      ...rules,
      global: {
        whitelist: kind === "whitelist" ? values : rules.global?.whitelist ?? [],
        blacklist: kind === "blacklist" ? values : rules.global?.blacklist ?? [],
      },
    };
  }
  const separator = scopeId.indexOf(":");
  const scope = scopeId.slice(0, separator) as "category" | "engine";
  const id = scopeId.slice(separator + 1);
  const key = scope === "category" ? "categories" : "engines";
  const next = { ...(rules[key] ?? {}) };
  next[id] = { ...(next[id] ?? {}), [kind]: values };
  return { ...rules, [key]: next };
}

export default function SettingsPage() {
  const [rules, setRules] = useState<SearchFilterRules>({
    global: emptyRuleScope,
    categories: {},
    engines: {},
  });
  const [scope, setScope] = useState<RuleScopeId>("global");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      let stored: SearchFilterRules | null = null;
      try {
        const raw = window.localStorage.getItem(RULES_STORAGE_KEY);
        if (raw) stored = JSON.parse(raw) as SearchFilterRules;
      } catch {
        stored = null;
      }
      try {
        const response = await fetch("/api/config");
        const data = (await response.json()) as ConfigResponse;
        if (!alive) return;
setConfig(data);
        if (stored) {
    setRules(stored);
        } else {
    setRules({
            global: {
              whitelist: data.lists.whitelist,
              blacklist: data.lists.blacklist,
            },
            categories: {},
            engines: {},
          });
        }
      } catch {
        // /api/config unreachable — keep whatever localStorage gave us.
        if (stored && alive) {
    setRules(stored);
        }
      } finally {
        if (alive) {
    setHydrated(true);
        }
      }
    }
    bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // localStorage unavailable — silently skip.
    }
  }, [rules, hydrated]);

  const currentScope = readScope(rules, scope);
  const categories = config?.categories ?? [];
  const engines = config?.engines ?? [];

  function updateScope(kind: "whitelist" | "blacklist", text: string) {
    setRules((prev) => writeScope(prev, scope, kind, parseDomainText(text)));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to search
          </Link>
          <div className="font-heading text-lg font-medium leading-none tracking-tight">
            Settings
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="rounded-md shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-medium tracking-tight">
              Domain rules
            </CardTitle>
            <CardDescription>
              One domain per line. Saved to your browser and applied to every search.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as RuleScopeId)}
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
                value={(currentScope.whitelist ?? []).join("\n")}
                onChange={(event) => updateScope("whitelist", event.target.value)}
                placeholder="example.com"
                className="min-h-32 resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Blacklist</Label>
              <Textarea
                value={(currentScope.blacklist ?? []).join("\n")}
                onChange={(event) => updateScope("blacklist", event.target.value)}
                placeholder="spam.example"
                className="min-h-32 resize-y font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
