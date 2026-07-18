import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");
const load = async (path) => JSON.parse(await read(path));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [goal, app, styles, html, sw] = await Promise.all([
  load("data/design/p3_1_visual_goal.json"),
  read("src/app.js"),
  read("src/styles.css"),
  read("index.html"),
  read("sw.js")
]);

assert(goal.version === "P3.1-visual", "P3.1 visual goal must be present");
assert(app.includes('DATA_VERSION = "p31-visual-01"') && html.includes('"p31-visual-01"'), "P3.1 runtime cache-buster missing");
assert(sw.includes("ffo-pwa-v10-p31-visual") && sw.includes("p3_1_visual_goal.json"), "P3.1 service worker cache missing");
assert(app.includes("data.mapSceneById = Object.fromEntries(data.mapScenes.map((scene) => [scene.mapId, scene]))"), "runtime must index scene profiles by mapId");

for (const hook of [
  "drawCommercialBackdrop",
  "drawCommercialMapLight",
  "map_town_forest_v1",
  "mini-terrain water",
  "mini-terrain path",
  "mini-landmark"
]) {
  assert(app.includes(hook) || styles.includes(hook), `commercial map/minimap hook missing: ${hook}`);
}

for (const fx of [
  "slashArc",
  "impactSpark",
  "shockwave",
  "afterimage",
  "screenShakeUntil",
  "hitStopUntil",
  "enemyKnockUntil"
]) {
  assert(app.includes(fx), `stable combat dynamic effect missing: ${fx}`);
}

for (const styleHook of [
  "P3.1 commercial visual lock",
  ".skill-wheel .attack-btn",
  ".mini-terrain.water",
  ".mini-map-dot.player",
  ".class-card"
]) {
  assert(styles.includes(styleHook), `commercial UI style missing: ${styleHook}`);
}

assert(!app.includes("<button>战</button>") && !app.includes("<button data-action=\"save\">存</button>"), "text glyph buttons must not return");
console.log("P3.1 commercial visual quality gate passed");
