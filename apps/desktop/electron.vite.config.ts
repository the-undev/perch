import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {},
  preload: {
    // A sandboxed preload cannot load an ES module, so it is built as CommonJS.
    build: { rolldownOptions: { output: { format: "cjs" } } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});
