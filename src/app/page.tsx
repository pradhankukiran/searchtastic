import { Suspense } from "react";

import { SearchApp } from "@/components/search-app";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";

  return (
    <Suspense>
      <SearchApp initialQuery={initialQuery} />
    </Suspense>
  );
}
