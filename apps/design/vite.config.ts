import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A local tool: `pnpm design` at the root serves it; it is never deployed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
