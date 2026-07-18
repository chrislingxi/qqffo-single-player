import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");
const load = async (path) => JSON.parse(await read(path));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [app, styles, html, sw, manifest, quests, maps, spawns, skills] = await Promise.all([
  read("src/app.js"),
  read("src/styles.css"),
  read("index.html"),
  read("sw.js"),
  load("assets/game/qstyle/manifest.json"),
  load("data/design/quests.json"),
  load("data/design/maps.json"),
  load("data/design/spawns.json"),
  load("data/design/skills.json")
]);

assert(app.includes('DATA_VERSION = "p33-rpg-slice-01"') && html.includes('"p33-rpg-slice-01"'), "P3.3 runtime cache-buster missing");
assert(sw.includes("ffo-pwa-v12-p33-rpg"), "P3.3 service worker cache must be bumped");
assert(app.includes("P33_EXPERIENCE") && app.includes("p3_3_20min_assassin_rpg_slice"), "P3.3 experience flag and save marker missing");
assert(app.includes("applyP33ExperienceStateToFreshState") && app.includes("setTimeout(() => guideQuest(), 320)"), "P3.3 must start as a guided playable assassin run");
assert(app.includes("drawP33MapBackdrop") && app.includes("P33_MAP_BACKGROUNDS"), "P3.3 per-map background runtime missing");
assert(app.includes("renderJourneyTrack") && styles.includes(".journey-track"), "P3.3 journey UI missing");
assert(app.includes("nextLockedMainQuest") && app.includes("练级衔接"), "P3.3 must explain level-gated main quest gaps");
assert(app.includes("if (P33_EXPERIENCE || Math.random() < 0.35 || !state.pets.length)"), "P3.3 pet capture must not be probability-blocked");
assert(app.includes("function spawnForMonster(monsterId, preferredMapId = null)") && app.includes("spawn.mapId === preferredMapId"), "quest navigation must prefer the original quest map before fallback spawns");

for (const id of [
  "p33_taoyuan_village",
  "p33_fangcao_meadow",
  "p33_yangyuan_plain",
  "p33_flower_nest"
]) {
  assert(manifest.some((asset) => asset.id === id && asset.asset_maturity === "p33_runtime_map_v1"), `missing P3.3 map art manifest entry: ${id}`);
  assert(sw.includes(manifest.find((asset) => asset.id === id).q_asset.replace(/^\.\//, "")) || sw.includes(manifest.find((asset) => asset.id === id).q_asset), `P3.3 map art not cached: ${id}`);
}

for (const mapId of ["taoyuan_village", "fangcao", "fangcao_east", "yangyuan_mid", "dungeon_nest"]) {
  assert(maps.some((map) => map.id === mapId), `missing vertical map: ${mapId}`);
  assert(spawns.some((spawn) => spawn.mapId === mapId && (spawn.maxAlive || spawn.radius)), `missing ecological spawn zone: ${mapId}`);
}

for (const type of ["talk", "kill", "collect", "catch_pet", "dungeon", "allocate_attr", "equip_item", "clear_activity"]) {
  assert(quests.some((quest) => quest.objective.type === type), `20-minute quest chain missing objective type: ${type}`);
}

for (const skillId of ["qingli_yiji", "juji", "cuipoison", "dual_blade_mastery"]) {
  assert(skills.some((skill) => skill.classId === "assassin" && skill.id === skillId), `assassin skill missing: ${skillId}`);
}

for (const fx of ["slashArc", "impactSpark", "shockwave", "afterimage", "shadowDash", "poisonTrail", "petClaw", "telegraph"]) {
  assert(app.includes(fx), `combat effect template missing: ${fx}`);
}

for (const cssHook of [".p33-experience .top-menu", ".p33-experience .skill-wheel", ".p33-experience .quest-track", ".p33-experience .mini-map"]) {
  assert(styles.includes(cssHook), `P3.3 commercial HUD style missing: ${cssHook}`);
}

console.log("P3.3 RPG experience quality gate passed");
