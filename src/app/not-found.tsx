import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to search
      </Link>
    </div>
  );
}
