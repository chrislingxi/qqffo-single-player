import { readFile } from "node:fs/promises";

const loadJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const loadText = async (path) => readFile(path, "utf8");

const [mapScenes, spawns, app, css, standards] = await Promise.all([
  loadJson("data/design/map_scene_profiles.json"),
  loadJson("data/design/spawns.json"),
  loadText("src/app.js"),
  loadText("src/styles.css"),
  loadText("docs/prd/mobile-gameplay-standards.md")
]);

const fail = (message, evidence = {}) => {
  console.error(JSON.stringify({ status: "failed", message, evidence }, null, 2));
  process.exit(1);
};

const byMap = Object.groupBy(spawns, (spawn) => spawn.mapId);
const requiredScenes = ["taoyuan_village", "fangcao", "fangcao_east", "longcheng", "dungeon_tower"];
for (const mapId of requiredScenes) {
  const scene = mapScenes.find((item) => item.mapId === mapId);
  if (!scene) fail(`missing map scene profile: ${mapId}`);
  if (!scene.ground?.length || !scene.props?.length || !scene.weather || !("path" in scene)) {
    fail(`map scene profile is not complete: ${mapId}`, scene);
  }
}
if (!mapScenes.some((scene) => scene.water) || !mapScenes.some((scene) => /tower|spirit|dragon/.test(scene.theme))) {
  fail("map scenes do not cover water and dungeon/spirit themes");
}
if (!/function isWalkable/.test(app) || !/nearestWalkable/.test(app) || !/drawTerrainSignature/.test(app)) {
  fail("map boundary/walkability or terrain signature logic missing");
}

const multiZoneMaps = ["fangcao", "fangcao_east", "fangcao_west", "yangyuan_mid", "longcheng_south", "longcheng_north"];
for (const mapId of multiZoneMaps) {
  if ((byMap[mapId] || []).length < 2) fail(`map does not have multiple spawn zones: ${mapId}`, { zones: byMap[mapId] || [] });
}
if (!spawns.some((spawn) => spawn.maxAlive === 1 && spawn.respawn >= 18)) {
  fail("elite/boss independent spawn logic is missing");
}
if (!/drawSpawnZoneHints/.test(app) || !/spawnInstancesForMap/.test(app) || !/respawnAt/.test(app)) {
  fail("runtime monster ecology visibility/respawn logic missing");
}

const iconRequirements = ["quest", "bag", "map", "pet", "token", "tower", "weapon", "potion"];
for (const type of iconRequirements) {
  if (!app.includes(`${type}: \`<svg`)) fail(`svg icon missing: ${type}`);
}
if (/"卷"|"囊"|"图"|"宠"|"令"|"塔"/.test(app.match(/const items = \[[\s\S]*?\];/)?.[0] || "")) {
  fail("top menu still uses text glyphs as icon body");
}
if (!/\.icon-frame/.test(css) || !/\.skill-icon/.test(css)) fail("icon CSS for SVG frames missing");

const skillEffects = ["flame", "ice", "poison", "light", "slash", "heal", "petClaw", "rune"];
for (const effect of skillEffects) {
  if (!app.includes(effect)) fail(`skill effect template missing: ${effect}`);
}
if (!/statusIconsHtml/.test(app) || !/status-icon/.test(css)) fail("buff/debuff status icons missing");

const petFields = ["生命", "法力", "等级", "饥渴", "信赖", "命中", "魔攻", "魔防", "力量", "体质", "敏捷", "智慧", "灵巧", "精神", "战斗技能", "生活技能", "我的宠物列表"];
for (const text of petFields) {
  if (!app.includes(text)) fail(`pet strong-system panel field missing: ${text}`);
}
if (!/pet-system-panel/.test(app) || !/pet-vitals/.test(app) || !/pet-attr-grid/.test(app)) {
  fail("pet system panel structure missing");
}

if (!/questWarp/.test(app) || !/任务传送/.test(app) || !/setTarget\(.*questWarp/s.test(app)) {
  fail("task teleport/cross-map pathing closure missing");
}

for (const standard of ["系统入口 icon 不能用纯文字", "怪物不能只作为单点战斗入口", "每张地图必须有个性化地表"]) {
  if (!standards.includes(standard)) fail(`standard not written: ${standard}`);
}

console.log(JSON.stringify({
  status: "passed",
  mapScenes: mapScenes.length,
  spawnZones: spawns.length,
  checkedMaps: multiZoneMaps,
  iconRequirements,
  skillEffects,
  petFields: petFields.length
}, null, 2));
