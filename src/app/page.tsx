import { Suspense } from "react";

import { SearchApp } from "@/components/search-app";

export default function Home() {
  return (
    <Suspense>
      <SearchApp />
    </Suspense>
  );
}
