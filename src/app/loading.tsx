import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
