import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const read = async (path) => await readFile(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const slice = await load("data/design/vertical_slice.json");
const classes = await load("data/design/classes.json");
const skills = await load("data/design/skills.json");
const maps = await load("data/design/maps.json");
const scenes = await load("data/design/map_scene_profiles.json");
const monsters = await load("data/design/monsters.json");
const spawns = await load("data/design/spawns.json");
const quests = await load("data/design/quests.json");
const app = await read("src/app.js");
const styles = await read("src/styles.css");

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));
const classById = byId(classes);
const mapById = byId(maps);
const sceneById = byId(scenes.map((scene) => ({ ...scene, id: scene.mapId })));
const monsterById = byId(monsters);
const skillById = byId(skills);

assert(slice.classId === "assassin", "vertical slice must target assassin");
assert(classById.assassin?.attackInterval <= 0.9, "assassin must keep fast attack interval");
assert(slice.levelRange[1] === 20, "vertical slice must cap at level 20");

for (const map of slice.maps) {
  assert(mapById[map.id], `slice map missing: ${map.id}`);
  assert(sceneById[map.id], `slice map scene profile missing: ${map.id}`);
  assert(Array.isArray(sceneById[map.id].props) && sceneById[map.id].props.length >= 3, `slice map needs personalized props: ${map.id}`);
}

for (const id of slice.combat.requiredSkills) {
  const skill = skillById[id];
  assert(skill, `slice skill missing: ${id}`);
  assert(skill.classId === "assassin", `slice skill must be assassin skill: ${id}`);
  assert(skill.levelReq <= 12, `slice skill should unlock in 1-12 curve: ${id}`);
}

const sliceMonsterIds = ["fenfen_rabbit", "man_eater_flower", "boar", "elite_boar", "flower_queen"];
for (const id of sliceMonsterIds) {
  assert(monsterById[id], `slice monster missing: ${id}`);
}

for (const mapId of ["fangcao", "yangyuan_mid", "dungeon_nest"]) {
  const zones = spawns.filter((spawn) => spawn.mapId === mapId);
  assert(zones.length >= 1, `slice map needs spawn zones: ${mapId}`);
  assert(zones.every((zone) => zone.radius > 0 && zone.respawn > 0), `spawn zones need radius and respawn: ${mapId}`);
}
assert(slice.maps.some((map) => map.id === "longcheng" && map.role.includes("主城")), "slice must explicitly include main city longcheng");

const mainBefore20 = quests.filter((quest) => quest.chain === "main" && quest.levelReq <= 20);
assert(mainBefore20.length >= 8, "slice needs a meaningful 1-20 main quest chain");
assert(mainBefore20.some((quest) => quest.objective.type === "dungeon" && quest.objective.target === "dungeon_nest"), "slice needs 20-before dungeon trial");
assert(mainBefore20.some((quest) => quest.objective.type === "catch_pet"), "slice needs pet capture in 1-20");

for (const needle of [
  "VERTICAL_SLICE",
  "tickCombatPosition",
  "shadowDash",
  "poisonTrail",
  "state.level >= VERTICAL_SLICE.maxLevel",
  "node.dataset.class !== VERTICAL_SLICE.classId"
]) {
  assert(app.includes(needle), `runtime missing vertical-slice behavior: ${needle}`);
}

const pointIndex = app.indexOf("const point = combatTextPoint();");
const assassinHitIndex = app.indexOf('if (skill.id === "qingli_yiji")');
assert(pointIndex > 0 && assassinHitIndex > pointIndex, "assassin skill fx must declare combat text point before use");

for (const needle of ["skill-wheel", "top-menu", "mmo-stage", "rotate-lock", "class-card locked"]) {
  assert(styles.includes(needle.replace(" ", ".")) || styles.includes(needle), `styles missing commercial HUD hook: ${needle}`);
}

console.log("P2.5 assassin vertical slice checks passed");
