import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const read = async (path) => readFile(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const goal = await load("data/design/p3_m4_goal.json");
const scenes = await load("data/design/map_scene_profiles.json");
const spawns = await load("data/design/spawns.json");
const app = await read("src/app.js");
const styles = await read("src/styles.css");
const sw = await read("sw.js");
const html = await read("index.html");
const pkg = await load("package.json");

const sceneById = Object.fromEntries(scenes.map((scene) => [scene.mapId, scene]));
assert(goal.version === "P3.0-M4", "P3.0 M4 goal spec missing or wrong version");
assert(app.includes('DATA_VERSION = "p31-visual-01"'), "runtime DATA_VERSION must be P3.1 visual build");
assert(sw.includes("ffo-pwa-v10-p31-visual"), "service worker cache must be bumped for P3.1 visual build");
assert(pkg.scripts["verify:p3-m4"] === "node tests/p3-m4-quality-gate.mjs", "package must expose verify:p3-m4");
assert(html.includes("boot-screen") && styles.includes(".boot-screen"), "fastboot transition screen must be present before app JS loads");
assert(html.includes("await import(`./src/app.js") && !html.includes('type="module" src="src/app.js"'), "index must clear stale PWA cache before importing app runtime");
assert(app.includes("renderLoadingScreen") && app.includes("preloadSpritesForCurrentMap") && app.includes("preloadAllSpritesInBackground"), "runtime must expose staged loading and lazy sprite preload");
assert(!sw.includes("qqffo-qstyle-concept-sheet-v1.png") && !sw.includes("town-forest-map-v1.png") && !sw.includes("tongtian_guardian_boss.png"), "service worker core cache must not block install on large art assets");
assert(app.includes("renderPanel({ force: document.querySelector(\".hud\")?.classList.contains(\"open\") })"), "closed HUD must not continuously rebuild panel HTML");
assert(app.includes("drawNavigationAids(camera);") && app.includes("drawWorldActors(camera);"), "canvas must separate navigation aids from depth-sorted actors");
assert(styles.includes("P3.0 M4.1 EOF lock") && styles.trim().endsWith("}"), "experience lock must be final cascade");

for (const mapId of goal.referenceMaps) {
  const scene = sceneById[mapId];
  assert(scene, `missing scene profile: ${mapId}`);
  assert((scene.ground || []).length >= 3, `scene needs layered ground colors: ${mapId}`);
  assert((scene.props || []).length >= 4, `scene needs landmark props: ${mapId}`);
}

const benchmark = sceneById.fangcao_east;
for (const kind of ["bamboo", "bridge", "rock", "bush"]) {
  assert(benchmark.props.some((prop) => prop[0] === kind), `fangcao_east benchmark missing prop: ${kind}`);
}
assert(benchmark.water, "fangcao_east benchmark must include water");

for (const mapId of ["fangcao", "fangcao_east", "yangyuan_mid", "dungeon_nest"]) {
  const zones = spawns.filter((spawn) => spawn.mapId === mapId);
  assert(zones.length >= 1, `missing spawn zones for ${mapId}`);
  assert(zones.every((zone) => zone.maxAlive || zone.radius), `spawn zones need density/radius for ${mapId}`);
}

for (const needle of [
  "drawPainterlyTexture",
  "drawDepthFoliage",
  "drawTargetRing",
  "drawCombatTelegraph",
  "drawWorldActors",
  "drawFallbackSprite",
  "telegraph",
  "renderMiniMap",
  "p3-version"
]) {
  assert(app.includes(needle) || styles.includes(needle), `P3.0 M4 runtime hook missing: ${needle}`);
}

for (const needle of [
  ".bottom-hotbar",
  ".mini-map-dot",
  ".p3-version",
  ".mmo-icon",
  ".skill-wheel"
]) {
  assert(styles.includes(needle), `P3.0 M4 style hook missing: ${needle}`);
}

for (const type of ["shadowDash", "poisonTrail", "petClaw", "rune", "slash", "spear", "telegraph"]) {
  assert(app.includes(type), `skill fx template missing: ${type}`);
}

console.log("P3.0 M4 quality gates passed");
