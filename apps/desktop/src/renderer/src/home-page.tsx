import { Button } from "@perch/ui/primitives/button.tsx";
import { useQuery } from "@tanstack/react-query";
import type { PerchApi } from "../../shared/ipc.ts";

/** The placeholder page: the app's name and version, read from the main process. */
export function HomePage({ api }: { api: PerchApi }) {
  const version = useQuery({
    queryKey: ["appVersion"],
    queryFn: () => api.appVersion(),
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="font-semibold text-3xl">perch</h1>
      <p className="text-muted-foreground">
        {version.data ? `Version ${version.data}` : "Reading version"}
      </p>
      <Button variant="outline" onClick={() => void version.refetch()}>
        Ask again
      </Button>
    </main>
  );
}
