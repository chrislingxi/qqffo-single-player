import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");
const load = async (path) => JSON.parse(await read(path));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [goal, app, styles, html, sw, manifest] = await Promise.all([
  load("data/design/p3_1_visual_goal.json"),
  read("src/app.js"),
  read("src/styles.css"),
  read("index.html"),
  read("sw.js"),
  load("assets/game/qstyle/manifest.json")
]);

assert(goal.version === "P3.1-visual", "P3.1 visual goal must be present");
assert(app.includes('DATA_VERSION = "p33-rpg-slice-01"') && html.includes('"p33-rpg-slice-01"'), "P3.3 runtime cache-buster missing");
assert(sw.includes("ffo-pwa-v12-p33-rpg") && sw.includes("p3_1_visual_goal.json"), "P3.3 service worker cache missing");
assert(app.includes("data.mapSceneById = Object.fromEntries(data.mapScenes.map((scene) => [scene.mapId, scene]))"), "runtime must index scene profiles by mapId");
assert(manifest.some((asset) => asset.id === "p32_bamboo_water_battlefield" && asset.asset_maturity === "p32_commercial_runtime_v1"), "P3.2 commercial battlefield asset missing from manifest");
assert(manifest.some((asset) => asset.id === "p32_combat_foreground" && asset.asset_maturity === "p32_commercial_runtime_v1"), "P3.2 commercial combat foreground asset missing from manifest");
assert(manifest.some((asset) => asset.id === "p33_taoyuan_village" && asset.asset_maturity === "p33_runtime_map_v1"), "P3.3 playable map asset missing from manifest");

for (const hook of [
  "drawCommercialBackdrop",
  "drawCommercialMapLight",
  "drawP32ShowcaseBackdrop",
  "drawP33MapBackdrop",
  "P33_EXPERIENCE",
  "p32_bamboo_water_battlefield",
  "p32_combat_foreground",
  "drawP32CombatForeground",
  "P32_SHOWCASE",
  "enterP32ShowcaseCombat",
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
  "P3.2 commercial screenshot lock",
  ".p32-showcase .top-menu",
  ".p32-showcase .skill-wheel",
  ".p32-showcase .quest-track",
  ".p33-experience .skill-wheel",
  ".p33-experience .quest-track",
  ".skill-wheel .attack-btn",
  ".mini-terrain.water",
  ".mini-map-dot.player",
  ".class-card"
]) {
  assert(styles.includes(styleHook), `commercial UI style missing: ${styleHook}`);
}

assert(!app.includes("<button>战</button>") && !app.includes("<button data-action=\"save\">存</button>"), "text glyph buttons must not return");
console.log("P3.3 commercial visual quality gate passed");
