"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SearchEngine } from "@/lib/search/types";

export type AppConfig = {
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

const AppConfigContext = createContext<AppConfig | null>(null);

export function AppConfigProvider({
  value,
  children,
}: {
  value: AppConfig;
  children: ReactNode;
}) {
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error("useAppConfig must be used within AppConfigProvider");
  }
  return ctx;
}
