"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function AppHeader() {
  const pathname = usePathname();
  const isSettings = pathname?.startsWith("/settings") ?? false;

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-heading text-lg font-medium tracking-tight text-foreground"
        >
          Searchtastic
        </Link>
        {isSettings ? (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to search
          </Link>
        ) : (
          <Link
            href="/settings"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Settings
          </Link>
        )}
      </div>
    </header>
  );
}
