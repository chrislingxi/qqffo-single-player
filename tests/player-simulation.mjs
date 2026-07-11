import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = async (name) => JSON.parse(await readFile(join(root, `data/design/${name}.json`), "utf8"));
const data = {
  classes: await load("classes"),
  levels: await load("levels"),
  skills: await load("skills"),
  quests: await load("quests"),
  monsters: await load("monsters"),
  drops: await load("drop_tables"),
  items: await load("items"),
  equipment: await load("equipment"),
  pets: await load("pets"),
  activities: await load("activities"),
  petRuntimeCatalog: await load("pet_runtime_catalog"),
  runtimeEndgameDungeons: await load("runtime_endgame_dungeons"),
  dungeons: await load("dungeons")
};

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));
data.monsterById = byId(data.monsters);
data.runtimeMonsterById = byId(data.runtimeEndgameDungeons.monsters);
data.petById = byId(data.pets);
data.dungeonById = byId(data.dungeons);
data.itemById = byId(data.items);
data.equipmentById = byId(data.equipment);
data.skillById = byId(data.skills);
data.activityById = byId(data.activities);

function expToNext(level, curve = data.levels.expCurve) {
  return Math.floor(curve.base * Math.pow(curve.growth, level - 1) + curve.flat * level * level);
}

function addExp(player, exp) {
  player.exp += exp;
  while (player.level < data.levels.maxLevel && player.exp >= expToNext(player.level)) {
    player.exp -= expToNext(player.level);
    player.level += 1;
    player.freeAttr += data.levels.attributePointsPerLevel;
    player.skillPoints += data.levels.skillPointsPerLevel;
  }
}

function monsterForLevel(level) {
  const candidates = data.monsters.filter((monster) => monster.type === "normal" && monster.level <= level + 2);
  return candidates.at(-1) || data.monsters[0];
}

function questTargetMonster(quest, level) {
  const obj = quest.objective;
  if (obj.type === "kill") return data.monsterById[obj.target];
  if (obj.type === "collect") {
    const table = data.drops.find((dropTable) => dropTable.drops.some((drop) => drop.id === obj.target));
    return data.monsterById[table.monsterId];
  }
  if (obj.type === "catch_pet") {
    const pet = data.petById[obj.target];
    if (!pet?.base || !pet.catchFrom || !pet.growthType || !pet.skill) throw new Error(`catch_pet target is not runtime-ready: ${obj.target}`);
    return data.monsterById[pet.catchFrom];
  }
  return monsterForLevel(level);
}

function petBattleStats(pet) {
  const base = data.petById[pet.id];
  if (!base?.base) throw new Error(`non-runtime pet reached battle stats: ${pet.id}`);
  return {
    maxHp: base.base.hp + pet.level * 16,
    attack: base.base.attack + pet.level * 4 + Math.floor(pet.trust / 10),
    defense: base.base.defense + pet.level * 2
  };
}

function defeat(player, monster, count = 1) {
  for (let i = 0; i < count; i += 1) {
    addExp(player, monster.exp);
    player.kills += 1;
  }
}

function completeReward(player, quest) {
  addExp(player, quest.rewards.exp || 0);
  player.gold += quest.rewards.gold || 0;
  for (const itemId of quest.rewards.items || []) {
    player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
  }
  player.completed.add(quest.id);
}

function runQuest(player, quest) {
  const obj = quest.objective;
  if (obj.type === "talk") {
    completeReward(player, quest);
    return;
  }
  if (obj.type === "kill" || obj.type === "kill_any") {
    defeat(player, questTargetMonster(quest, player.level), obj.count);
    completeReward(player, quest);
    return;
  }
  if (obj.type === "collect") {
    const monster = questTargetMonster(quest, player.level);
    defeat(player, monster, obj.count * 3);
    completeReward(player, quest);
    return;
  }
  if (obj.type === "catch_pet") {
    const monster = questTargetMonster(quest, player.level);
    defeat(player, monster, 4);
    const runtimePet = data.petById[obj.target];
    const caught = { uid: `${obj.target}_sim`, id: obj.target, level: Math.max(1, player.level - 1), trust: 50 };
    const stats = petBattleStats(caught);
    if (!Number.isFinite(stats.maxHp) || !Number.isFinite(stats.attack) || !Number.isFinite(stats.defense)) {
      throw new Error(`runtime pet stats are invalid: ${obj.target}`);
    }
    player.pets.push({ ...caught, name: runtimePet.name });
    completeReward(player, quest);
    return;
  }
  if (obj.type === "learn_skill") {
    const skill = data.skillById[obj.target];
    if (!skill || skill.classId !== player.classId || player.level < skill.levelReq) throw new Error(`skill quest not learnable: ${quest.id}`);
    player.learned.add(skill.id);
    completeReward(player, quest);
    return;
  }
  if (obj.type === "allocate_attr") {
    const spend = Math.min(player.freeAttr, obj.count);
    player.freeAttr -= spend;
    player.allocatedAttr += spend;
    if (spend < obj.count) throw new Error(`not enough attr points for ${quest.id}`);
    completeReward(player, quest);
    return;
  }
  if (obj.type === "equip_item") {
    if (!player.inventory[obj.target]) {
      player.inventory[obj.target] = 1;
    }
    const equip = data.equipmentById[obj.target];
    if (!equip) throw new Error(`equip quest target missing: ${obj.target}`);
    if (player.level < equip.levelReq) throw new Error(`equip quest level gate failed: ${quest.id}`);
    player.inventory[obj.target] -= 1;
    player.equipment[equip.slot] = { id: obj.target, plus: 0, sockets: 0 };
    completeReward(player, quest);
    return;
  }
  if (obj.type === "enhance_item") {
    const slot = obj.slot || "weapon";
    player.equipment[slot] ||= { id: "forest_weapon", plus: 0, sockets: 0 };
    player.equipment[slot].plus = Math.max(player.equipment[slot].plus || 0, obj.plus || 1);
    player.researchActions += 1;
    completeReward(player, quest);
    return;
  }
  if (obj.type === "socket_item") {
    const slot = obj.slot || "weapon";
    player.equipment[slot] ||= { id: "forest_weapon", plus: 0, sockets: 0 };
    player.equipment[slot].sockets = Math.max(player.equipment[slot].sockets || 0, obj.sockets || 1);
    player.researchActions += 1;
    completeReward(player, quest);
    return;
  }
  if (obj.type === "train_pet") {
    if (!player.pets.length) throw new Error(`pet training quest before pet capture: ${quest.id}`);
    player.pets[0].training = Math.max(player.pets[0].training || 0, obj.training || 1);
    player.researchActions += 1;
    completeReward(player, quest);
    return;
  }
  if (obj.type === "use_pet_skill_pill") {
    if (!player.pets.length) throw new Error(`pet skill quest before pet capture: ${quest.id}`);
    player.pets[0].skillLevel = Math.max(player.pets[0].skillLevel || 1, obj.skillLevel || 2);
    player.researchActions += 1;
    completeReward(player, quest);
    return;
  }
  if (obj.type === "activate_pet_circle") {
    if (!player.pets.length) throw new Error(`pet circle quest before pet capture: ${quest.id}`);
    player.pets[0].circle = true;
    player.researchActions += 1;
    completeReward(player, quest);
    return;
  }
  if (obj.type === "clear_activity") {
    const activity = data.activityById[obj.target];
    if (!activity) throw new Error(`activity quest target missing: ${obj.target}`);
    if (player.level < activity.levelReq) throw new Error(`activity level gate failed: ${quest.id}`);
    if (activity.dungeonId) {
      const dungeon = data.dungeonById[activity.dungeonId];
      for (const wave of dungeon.waves) {
        for (const monsterId of wave.monsterIds) {
          defeat(player, data.monsterById[monsterId], Math.ceil(wave.count / wave.monsterIds.length));
        }
      }
    } else {
      defeat(player, monsterForLevel(player.level), activity.target?.count || 12);
    }
    addExp(player, activity.rewards.exp || 0);
    player.gold += activity.rewards.gold || 0;
    for (const itemId of activity.rewards.items || []) {
      player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
    }
    player.completedActivities += 1;
    completeReward(player, quest);
    return;
  }
  if (obj.type === "dungeon") {
    const dungeon = data.dungeonById[obj.target];
    for (const wave of dungeon.waves) {
      for (const monsterId of wave.monsterIds) {
        defeat(player, data.monsterById[monsterId], Math.ceil(wave.count / wave.monsterIds.length));
      }
    }
    addExp(player, dungeon.rewards.exp);
    player.completedDungeons += 1;
    completeReward(player, quest);
  }
}

function nextMain(player) {
  return data.quests.find((quest) => quest.chain === "main" && !player.completed.has(quest.id));
}

function canRun(player, quest) {
  return quest && player.level >= quest.levelReq && (!quest.classId || quest.classId === player.classId);
}

function simulateClass(classId) {
  const player = {
    classId,
    level: 1,
    exp: 0,
    gold: 180,
    freeAttr: 0,
    skillPoints: 0,
    allocatedAttr: 0,
    kills: 0,
    pets: [],
    inventory: {},
    equipment: {},
    learned: new Set(),
    researchActions: 0,
    completedActivities: 0,
    completedDungeons: 0,
    completed: new Set()
  };

  let loops = 0;
  while ((nextMain(player) || player.level < 55 || player.completedDungeons < 4) && loops < 40000) {
    loops += 1;
    const main = nextMain(player);
    const career = data.quests.find((quest) => quest.chain === "career" && quest.classId === classId && !player.completed.has(quest.id));
    const dungeon = data.dungeons[player.completedDungeons];
    const side = data.quests.find((quest) => ["side", "repeat"].includes(quest.chain) && canRun(player, quest) && (!player.completed.has(quest.id) || quest.repeatable));
    const runnable = canRun(player, main) ? main : canRun(player, career) ? career : (dungeon && player.level >= dungeon.levelReq ? null : side);
    if (runnable) {
      runQuest(player, runnable);
    } else if (dungeon && player.level >= dungeon.levelReq) {
      for (const wave of dungeon.waves) {
        for (const monsterId of wave.monsterIds) {
          defeat(player, data.monsterById[monsterId], Math.ceil(wave.count / wave.monsterIds.length));
        }
      }
      addExp(player, dungeon.rewards.exp);
      player.gold += dungeon.rewards.gold;
      player.completedDungeons += 1;
    } else {
      defeat(player, monsterForLevel(player.level), 14);
    }
  }

  return { ...player, completed: player.completed.size, loops };
}

const results = data.classes.map((classDef) => ({ className: classDef.name, ...simulateClass(classDef.id) }));
function simulateRuntimeEndgame() {
  const player = { level: 110, exp: 0, gold: 0, kills: 0, inventory: {} };
  for (const dungeon of data.runtimeEndgameDungeons.dungeons) {
    if (player.level < dungeon.levelReq) throw new Error(`endgame simulation level gate failed: ${dungeon.id}`);
    for (const wave of dungeon.waves) {
      if (!wave.count || !wave.monsterIds.length) throw new Error(`endgame wave invalid: ${dungeon.id}`);
      for (const monsterId of wave.monsterIds) {
        const monster = data.runtimeMonsterById[monsterId];
        if (!monster) throw new Error(`endgame monster missing: ${monsterId}`);
        ["hp", "attack", "defense", "exp", "level"].forEach((key) => {
          if (!Number.isFinite(monster[key]) || monster[key] <= 0) throw new Error(`endgame monster ${monsterId} invalid ${key}`);
        });
        player.exp += monster.exp * wave.count;
        player.kills += wave.count;
      }
    }
    player.exp += dungeon.rewards.exp;
    player.gold += dungeon.rewards.gold;
    for (const itemId of dungeon.rewards.items) {
      if (!data.itemById[itemId] && !data.equipmentById[itemId]) throw new Error(`endgame reward missing: ${itemId}`);
      player.inventory[itemId] = (player.inventory[itemId] || 0) + 1;
    }
  }
  return player;
}

const endgame = simulateRuntimeEndgame();
console.table(results.map((result) => ({
  class: result.className,
  level: result.level,
  kills: result.kills,
  quests: result.completed,
  dungeons: result.completedDungeons,
  activities: result.completedActivities,
  research: result.researchActions,
  allocatedAttr: result.allocatedAttr,
  pets: result.pets,
  catalogPets: data.petRuntimeCatalog.count,
  loops: result.loops
})));
if (data.petRuntimeCatalog.count !== 378) throw new Error("full pet runtime catalog must contain 378 catalog-only pets");
if (data.petRuntimeCatalog.pets.some((pet) => pet.runtime_enabled || pet.base_runtime_stats)) {
  throw new Error("catalog-only pet was incorrectly promoted into runtime combat data");
}
if (data.runtimeEndgameDungeons.dungeons.length !== 9 || data.runtimeEndgameDungeons.monsters.length !== 59) {
  throw new Error("runtime endgame dungeons must include 9 dungeons and 59 monsters");
}
if (endgame.kills !== 59) throw new Error(`runtime endgame simulation did not clear all bosses: ${endgame.kills}`);
for (const result of results) {
  if (result.level < 55) throw new Error(`${result.className} did not reach level 55`);
  if (result.completedDungeons < 4) throw new Error(`${result.className} did not clear four dungeons`);
  if (result.pets.length < 1) throw new Error(`${result.className} did not catch a pet`);
  if (result.researchActions < 4) throw new Error(`${result.className} did not perform enough P2 research actions`);
  if (result.completedActivities < 3) throw new Error(`${result.className} did not complete enough activity-guided tasks`);
  if (result.loops >= 40000) throw new Error(`${result.className} simulation exceeded loop limit`);
}
console.log("P3 five-class player simulation passed");
