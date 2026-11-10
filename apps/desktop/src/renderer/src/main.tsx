import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashHistory, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FaultBoundary } from "./fault-boundary.tsx";
import { createAppRouter } from "./router.tsx";

const queryClient = new QueryClient();
const router = createAppRouter(
  { api: window.perch, queryClient },
  createHashHistory(),
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("index.html has no #root element");

createRoot(rootElement).render(
  <StrictMode>
    <FaultBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </FaultBoundary>
  </StrictMode>,
);
