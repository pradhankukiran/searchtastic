import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { readDomainList, readSearchEngines } from "@/lib/search/config";
import { AppConfigProvider, type AppConfig } from "@/lib/search/config-context";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const SEARXNG_CATEGORIES = [
  "general",
  "images",
  "videos",
  "news",
  "map",
  "music",
  "it",
  "science",
  "files",
  "social media",
];
const LANGUAGES = ["", "all", "en", "en-US", "de", "fr", "es", "hi"];
const PLUGINS = [
  "Tracker_URL_remover",
  "Ahmia_blacklist",
  "Open_Access_DOI_rewrite",
  "Hostnames_plugin",
  "Hash_plugin",
  "Self_Information",
  "Tor_check_plugin",
];

export const metadata: Metadata = {
  title: "Searchtastic",
  description: "A filtered metasearch app powered by SearXNG.",
};

async function loadAppConfig(): Promise<AppConfig> {
  try {
    const [engines, whitelist, blacklist] = await Promise.all([
      readSearchEngines(),
      readDomainList("whitelist.txt"),
      readDomainList("blacklist.txt"),
    ]);
    return {
      engines,
      categories: [...new Set(engines.map((engine) => engine.category))],
      searxngCategories: SEARXNG_CATEGORIES,
      languages: LANGUAGES,
      plugins: PLUGINS,
      lists: {
        whitelist,
        blacklist,
        whitelistCount: whitelist.length,
        blacklistCount: blacklist.length,
      },
      searxngConfigured: Boolean(process.env.SEARXNG_URL),
    };
  } catch {
    return {
      engines: [],
      categories: [],
      searxngCategories: SEARXNG_CATEGORIES,
      languages: LANGUAGES,
      plugins: PLUGINS,
      lists: { whitelist: [], blacklist: [], whitelistCount: 0, blacklistCount: 0 },
      searxngConfigured: Boolean(process.env.SEARXNG_URL),
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await loadAppConfig();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppConfigProvider value={config}>
          <AppHeader />
          <main className="flex flex-1 flex-col">{children}</main>
        </AppConfigProvider>
        <Toaster />
      </body>
    </html>
  );
}
