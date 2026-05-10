"use client";

import { useEffect, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppConfig } from "@/lib/search/config-context";
import type { DomainRuleScope, SearchFilterRules } from "@/lib/search/types";

type RuleScopeId = "global" | `category:${string}` | `engine:${string}`;

const RULES_STORAGE_KEY = "searchtastic.filter-rules.v1";

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

export function DomainRulesEditor() {
  const config = useAppConfig();
  const hydrated = useRef(false);
  const [rules, setRules] = useState<SearchFilterRules>(() => ({
    global: {
      whitelist: config.lists.whitelist,
      blacklist: config.lists.blacklist,
    },
    categories: {},
    engines: {},
  }));
  const [scope, setScope] = useState<RuleScopeId>("global");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RULES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SearchFilterRules;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRules(parsed);
      }
    } catch {
      // localStorage unavailable — keep config defaults.
    } finally {
      hydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // localStorage unavailable — silently skip.
    }
  }, [rules]);

  const currentScope = readScope(rules, scope);
  const { categories, engines } = config;

  function updateScope(kind: "whitelist" | "blacklist", text: string) {
    setRules((prev) => writeScope(prev, scope, kind, parseDomainText(text)));
  }

  return (
    <div className="space-y-4">
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
    </div>
  );
}
