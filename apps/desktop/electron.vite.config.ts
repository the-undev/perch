import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

/** The renderer's dev server port: PERCH_RENDERER_PORT for the isolated run, else the dev instance's. */
const rendererPort = Number(process.env.PERCH_RENDERER_PORT ?? 5175);

export default defineConfig({
  main: {},
  preload: {
    // A sandboxed preload cannot load an ES module, so it is built as CommonJS.
    build: { rolldownOptions: { output: { format: "cjs" } } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    // strictPort: Vite would otherwise move to the next port, into another app's.
    server: { port: rendererPort, strictPort: true },
  },
});
