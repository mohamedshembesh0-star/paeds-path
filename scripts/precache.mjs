// After `vite build`: list every built asset in the service worker so the app works fully offline after one visit.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const assets = readdirSync("dist/assets").map((f) => `assets/${f}`);
const sw = "dist/service-worker.js";
let src = readFileSync(sw, "utf8");
const version = assets.join("|").length.toString(36) + "-" + Date.now().toString(36);
src = src.replace(/const CACHE = "[^"]+";/, `const CACHE = "paeds-path-${version}";`);
src = src.replace(
  'new URL("icon-512.png", APP_ROOT).toString(),',
  'new URL("icon-512.png", APP_ROOT).toString(),\n' + assets.map((a) => `  new URL(${JSON.stringify(a)}, APP_ROOT).toString(),`).join("\n"),
);
writeFileSync(sw, src);
console.log(`precache: ${assets.length} assets`);
