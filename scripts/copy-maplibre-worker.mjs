// MapLibre GL v6 web worker'ı ayrı bir ES modülü olarak yükler; bundler bunu sunmadığı için
// public/vendor altına kopyalanır ve istemcide setWorkerUrl ile gösterilir.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
mkdirSync("public/vendor", { recursive: true });
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), "public/vendor/maplibre-gl-worker.mjs");
console.log("✓ maplibre-gl-worker.mjs → public/vendor");
