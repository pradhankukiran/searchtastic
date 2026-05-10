"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred. Try again or refresh the page."}
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
