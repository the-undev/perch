import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A local tool: `pnpm design` at the root serves it; it is never deployed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // strictPort: Vite would otherwise move to the next port, into another app's.
  server: { port: 5174, strictPort: true },
  // Served locally, never downloaded, so a large bundle costs nothing.
  build: { chunkSizeWarningLimit: 4000 },
});
