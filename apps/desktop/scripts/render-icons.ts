// Renders the app icon and the tray icon from their SVG sources into the PNGs electron-builder,
// the window and the tray read. Run with `pnpm icons` after changing either SVG.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { appIconSizes, trayIconFiles } from "../src/main/icons.ts";

const resources = join(import.meta.dirname, "..", "resources");

async function render(source: string, size: number, target: string) {
  const svg = await readFile(join(resources, source), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  await writeFile(join(resources, target), png);
  console.log(`${target}: ${size}px`);
}

for (const size of appIconSizes) {
  await render("icon.svg", size, join("icons", `${size}x${size}.png`));
}
for (const { file, size } of trayIconFiles) {
  await render("tray.svg", size, file);
}
