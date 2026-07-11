import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const requiredTables = [
  "classes",
  "skills",
  "levels",
  "attribute_formulas",
  "maps",
  "npcs",
  "monsters",
  "spawns",
  "quests",
  "items",
  "equipment",
  "drop_tables",
  "pets",
  "dungeons",
  "enhancement_rules",
  "activities",
  "advancement",
  "pet_training",
  "ascension",
  "level_cap_110",
  "late_growth",
  "full_pet_catalog",
  "pet_skills",
  "pet_growth",
  "pet_formations",
  "pet_runtime_catalog",
  "endgame_dungeons",
  "endgame_bosses",
  "runtime_endgame_dungeons",
  "endgame_maps",
  "endgame_materials",
  "full_equipment_catalog",
  "full_activity_catalog",
  "source_gaps",
  "p3_system_details"
];

async function json(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const forbiddenRuntimeTerms = /好友|空间|排行|队伍|组队|交易|可交易|玩家相互|帮派|家族|社交|竞争/;
const sourceNoiseTerms = /官网|上一页|下一页|专题页|背景故事|副本地图|副本视频|施工中|怪物特性|适合.*职业|加载中|每日小知识/;

const data = {};
for (const table of requiredTables) {
  data[table] = await json(`data/design/${table}.json`);
}
const qAssets = await json("assets/game/qstyle/manifest.json");
data.qAssets = qAssets;

assert(data.classes.length === 5, "P3 must include five classes");
for (const classDef of data.classes) {
  const skills = data.skills.filter((skill) => skill.classId === classDef.id);
  assert(skills.filter((skill) => skill.type === "active").length >= 3, `${classDef.name} needs active skills`);
  assert(skills.some((skill) => skill.type === "passive"), `${classDef.name} needs a passive skill`);
}

assert(data.maps.filter((map) => map.type === "main_city").length >= 1, "P3 needs a main city");
assert(data.maps.filter((map) => map.type === "starter").length >= 1, "P3 needs a starter village");
assert(data.maps.filter((map) => map.type === "wild").length >= 3, "P3 needs at least three wild maps");
assert(data.dungeons.length >= 2, "P3 needs two baseline solo dungeons");
assert(data.dungeons.length >= 4, "P3 needs four solo dungeons");
assert(data.pets.length >= 5, "P3 needs at least five catchable pets");
assert(qAssets.some((asset) => asset.id === "ghost_fire" && asset.original_asset !== "missing"), "ghost_fire needs original reference asset");
assert(qAssets.filter((asset) => asset.q_asset && asset.q_asset !== "missing").length >= 6, "P3 needs Q-style runtime monster assets");
assert(qAssets.some((asset) => asset.id === "runtime_endgame_通天魔劫塔_monster_1_通天魔劫塔守关BOSS" && asset.q_asset === "assets/game/qstyle/ai/sprites/tongtian_guardian_boss.png"), "Tongtian runtime boss needs Q-style sprite asset");
for (const asset of qAssets.filter((item) => item.q_asset && item.q_asset !== "missing")) {
  assert(asset.asset_maturity, `${asset.id} must declare asset_maturity`);
}
for (const classDef of data.classes) {
  assert(qAssets.some((asset) => asset.id === `character_${classDef.id}` && asset.q_asset !== "missing"), `${classDef.name} needs a Q-style character asset`);
}
assert(data.levels.maxLevel >= 55, "P3 must extend the solo growth curve to level 55");
assert(data.levels.maxLevel >= 110, "P3 must extend the solo growth curve to level 110");
assert(data.activities.length >= 4, "P3 needs daily solo activities");
assert(data.enhancement_rules.maxPlus >= 9, "P3 needs equipment enhancement up to +9");
assert(data.advancement.firstJob && data.advancement.ascension, "P3 needs advancement and ascension rules");
assert(data.pet_training.maxSkillLevel >= 5, "P3 needs pet skill training");
assert(data.full_pet_catalog.count >= 300, "P3 needs the full localized pet catalog");
assert(data.pet_skills.length >= 20, "P3 needs localized pet skills");
assert(data.pet_growth.max_level >= 80, "P3 needs pet level experience data");
assert(data.pet_formations.formations.length >= 2, "P3 needs pet formation data");
assert(data.pet_runtime_catalog.count === 378, "P3 needs 378 localized catalog pets");
assert(data.pet_runtime_catalog.pets.length === data.pet_runtime_catalog.count, "P3 pet runtime catalog count mismatch");
assert(data.pet_runtime_catalog.source_integrity.list_count === 378, "P3 pet source list must be fully joined");
assert(data.pet_runtime_catalog.source_integrity.detail_count === 378, "P3 pet source details must be fully joined");
assert(data.pet_runtime_catalog.source_integrity.failed_details.length === 0, "P3 pet details must not have failed fetches");
assert(data.pet_runtime_catalog.runtime_enabled_count === 0, "P3 catalog-only pets must not be runtime enabled yet");
const petCatalogIds = new Set(data.pet_runtime_catalog.pets.map((pet) => pet.id));
assert(petCatalogIds.size === data.pet_runtime_catalog.count, "P3 pet catalog ids must be unique");
assert(data.pet_runtime_catalog.pets.every((pet) => pet.id === `ffo_pet_${pet.catalog_uid}`), "P3 pet id must map to catalog uid");
assert(data.pet_runtime_catalog.pets.some((pet) => pet.original_name === "？？？"), "P3 pet catalog must preserve unknown-name entries");
assert(data.pet_runtime_catalog.pets.every((pet) => pet.runtime_enabled === false && pet.gameplay_status === "catalog_only"), "P3 catalog pets must be marked catalog-only");
assert(data.pet_runtime_catalog.pets.every((pet) => Array.isArray(pet.gaps) && pet.gaps.length > 0), "P3 catalog pets must expose data gaps");
assert(data.pet_runtime_catalog.pets.every((pet) => !("base_runtime_stats" in pet) && !("growth_type" in pet)), "P3 catalog pets must not invent combat stats");
assert(data.late_growth.systems.length >= 9, "P3 needs late growth systems");
assert(data.endgame_dungeons.records.length >= 4, "P3 needs endgame dungeon catalog entries");
assert(data.endgame_bosses.dungeon_count >= 9, "P3 needs nine endgame dungeon boss catalogs");
assert(data.endgame_bosses.boss_count >= 30, "P3 needs localized endgame boss/object entries");
assert(data.endgame_bosses.dungeons.every((dungeon) => dungeon.frequency_rule?.mode), "P3 boss dungeons need frequency rules");
const bossForbiddenNames = /图谱|碎片|宝石|之魂|幻化书|宝盒|宝藏|谢礼|副本|背景故事|昆仑雪$/;
for (const boss of data.endgame_bosses.bosses) {
  assert(!bossForbiddenNames.test(boss.original_name), `P3 boss catalog contains reward/source noise: ${boss.original_name}`);
  assert(boss.single_player_rules?.entry_mode === "solo", `P3 boss must be single-player adapted: ${boss.id}`);
  assert(Array.isArray(boss.gaps) && boss.gaps.length > 0, `P3 boss must carry unresolved stat/mechanic gaps: ${boss.id}`);
  assert(!forbiddenRuntimeTerms.test(JSON.stringify(boss.single_player_rules)), `P3 boss runtime contains multiplayer/social text: ${boss.id}`);
}
assert(data.runtime_endgame_dungeons.dungeon_count === 9, "Loop04 needs nine runtime endgame dungeons");
assert(data.runtime_endgame_dungeons.monster_count === data.endgame_bosses.boss_count, "Loop04 runtime monsters must cover all endgame boss/object entries");
assert(data.runtime_endgame_dungeons.map_count === 9, "Loop04 needs one runtime map per endgame dungeon");
const runtimeMapIds = new Set([...data.maps.map((map) => map.id), ...data.runtime_endgame_dungeons.maps.map((map) => map.id)]);
const runtimeMonsterIds = new Set([...data.monsters.map((monster) => monster.id), ...data.runtime_endgame_dungeons.monsters.map((monster) => monster.id)]);
const runtimeItemIds = new Set([...data.items.map((item) => item.id), ...data.equipment.map((item) => item.id)]);
for (const dungeon of data.runtime_endgame_dungeons.dungeons) {
  assert(Number.isFinite(dungeon.levelReq) && dungeon.levelReq >= 1, `runtime dungeon needs numeric levelReq: ${dungeon.id}`);
  assert(runtimeMapIds.has(dungeon.entryMap), `runtime dungeon entry map missing: ${dungeon.id}`);
  assert(dungeon.waves.length > 0 && dungeon.waves.every((wave) => wave.count > 0), `runtime dungeon needs playable waves: ${dungeon.id}`);
  dungeon.waves.forEach((wave) => wave.monsterIds.forEach((id) => assert(runtimeMonsterIds.has(id), `runtime dungeon references missing monster: ${id}`)));
  assert(Array.isArray(dungeon.rewards.items), `runtime dungeon rewards need items array: ${dungeon.id}`);
  dungeon.rewards.items.forEach((id) => assert(runtimeItemIds.has(id), `runtime dungeon reward missing item/equipment: ${id}`));
  assert(dungeon.single_player_balance === true, `runtime dungeon must mark local balance: ${dungeon.id}`);
  assert(dungeon.source_confidence === "single_player_runtime_adapter", `runtime dungeon must not claim official full stats: ${dungeon.id}`);
}
const tongtianRuntime = data.runtime_endgame_dungeons.dungeons.find((dungeon) => dungeon.id === "runtime_endgame_通天魔劫塔");
assert(tongtianRuntime?.mechanics.timer_seconds === 300, "Tongtian runtime trial needs 300s floor timer");
assert(tongtianRuntime?.mechanics.revive_pool === 5, "Tongtian runtime trial needs five-revive pool");
for (const monster of data.runtime_endgame_dungeons.monsters) {
  assert(["boss", "elite"].includes(monster.type), `runtime endgame monster has unsupported type: ${monster.id}`);
  ["hp", "attack", "defense", "exp", "level"].forEach((key) => assert(Number.isFinite(monster[key]) && monster[key] > 0, `runtime monster ${monster.id} has invalid ${key}`));
  assert(monster.stat_confidence === "single_player_balance", `runtime monster must mark local stats: ${monster.id}`);
}
assert(data.endgame_materials.materials.length >= 8, "P3 needs endgame materials catalog");
assert(data.full_equipment_catalog.categories.length >= 5, "P3 needs full equipment catalog shell");
assert(data.full_activity_catalog.activities.length >= 6, "P3 needs full activity catalog");
assert(data.source_gaps.gaps.length >= 1, "P3 must track unresolved official-data gaps");
assert(data.p3_system_details.systems.length >= 6, "P3 needs structured late-system rule details");
assert(data.p3_system_details.systems.some((system) => system.id === "tongtian_mojieta" && system.rules?.floors === 30), "P3 needs Tongtian Mojie Tower floors");
assert(data.p3_system_details.systems.some((system) => system.id === "dragon_wing_treasure" && system.processing?.max_level === 10), "P3 needs Dragon Wing Treasure processing rules");
assert(data.p3_system_details.systems.some((system) => system.id === "wing_carving" && system.rules?.max_process_level === 15), "P3 needs wing carving rules");
assert(data.endgame_dungeons.records.every((dungeon) => dungeon.single_player_runtime?.entry_mode === "solo"), "P3 endgame dungeons need solo runtime rules");
for (const dungeon of data.endgame_dungeons.records) {
  const runtimeText = JSON.stringify(dungeon.single_player_runtime || {});
  assert(!forbiddenRuntimeTerms.test(runtimeText), `P3 dungeon runtime contains multiplayer/social text: ${dungeon.id}`);
  assert(!sourceNoiseTerms.test(runtimeText), `P3 dungeon runtime contains source-page noise: ${dungeon.id}`);
  assert(Array.isArray(dungeon.single_player_runtime?.display_rewards), `P3 dungeon runtime needs display rewards: ${dungeon.id}`);
  assert(dungeon.single_player_runtime?.frequency_rule?.mode, `P3 dungeon runtime needs structured frequency: ${dungeon.id}`);
}
assert(data.endgame_materials.runtime_materials.length >= 8, "P3 needs clean runtime endgame materials");
for (const material of data.endgame_materials.runtime_materials) {
  assert(!forbiddenRuntimeTerms.test(JSON.stringify(material)), `P3 runtime material contains multiplayer/social text: ${material.id}`);
  assert(data.endgame_materials.materials.some((item) => item.id === material.id && item.runtime_enabled), `P3 runtime material must come from runtime-enabled source: ${material.id}`);
}
assert(data.full_activity_catalog.activities.every((activity) => activity.single_player_runtime?.party_requirement === "none"), "P3 activities need single-player runtime rules");
for (const activity of data.full_activity_catalog.activities) {
  const runtimeText = JSON.stringify(activity.single_player_runtime || {});
  assert(!forbiddenRuntimeTerms.test(runtimeText), `P3 activity runtime contains multiplayer/social text: ${activity.project_name}`);
}

const monsterIds = new Set(data.monsters.map((monster) => monster.id));
const qAssetIds = new Set(qAssets.map((asset) => asset.id));
const itemIds = new Set([...data.items.map((item) => item.id), ...data.equipment.map((item) => item.id)]);
for (const monster of data.monsters) {
  assert(qAssetIds.has(monster.id), `runtime monster ${monster.id} needs a Q-style asset mapping`);
}
for (const spawn of data.spawns) {
  assert(data.maps.some((map) => map.id === spawn.mapId), `spawn ${spawn.id} has invalid map`);
  spawn.monsterIds.forEach((id) => assert(monsterIds.has(id), `spawn ${spawn.id} references missing monster ${id}`));
}
for (const table of data.drop_tables) {
  assert(table.id, `drop table for ${table.monsterId} needs stable id`);
  assert(monsterIds.has(table.monsterId), `drop table references missing monster ${table.monsterId}`);
  table.drops.forEach((drop) => assert(itemIds.has(drop.id), `drop references missing item ${drop.id}`));
}
for (const quest of data.quests) {
  assert(quest.objective && quest.rewards, `quest ${quest.id} must have objective and rewards`);
  if (quest.objective.type === "kill") assert(monsterIds.has(quest.objective.target), `quest ${quest.id} kill target missing`);
  if (quest.objective.type === "collect") assert(itemIds.has(quest.objective.target), `quest ${quest.id} collect target missing`);
}

console.log("P3 smoke data checks passed");
