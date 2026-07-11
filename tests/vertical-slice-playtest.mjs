import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const load = async (name) => JSON.parse(await readFile(join(root, `data/design/${name}.json`), "utf8"));

const data = {
  slice: JSON.parse(await readFile(join(root, "data/design/vertical_slice.json"), "utf8")),
  levels: await load("levels"),
  skills: await load("skills"),
  quests: await load("quests"),
  monsters: await load("monsters"),
  drops: await load("drop_tables"),
  equipment: await load("equipment"),
  pets: await load("pets"),
  activities: await load("activities"),
  dungeons: await load("dungeons")
};

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));
const monsterById = byId(data.monsters);
const equipmentById = byId(data.equipment);
const petById = byId(data.pets);
const activityById = byId(data.activities);
const dungeonById = byId(data.dungeons);
const skillById = byId(data.skills);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expToNext(level) {
  const curve = data.levels.expCurve;
  return Math.floor(curve.base * Math.pow(curve.growth, level - 1) + curve.flat * level * level);
}

function addExp(player, amount) {
  player.exp += Math.floor(amount);
  while (player.level < data.slice.levelRange[1] && player.exp >= expToNext(player.level)) {
    player.exp -= expToNext(player.level);
    player.level += 1;
    player.freeAttr += data.levels.attributePointsPerLevel;
    player.unlockedSkills = data.skills
      .filter((skill) => skill.classId === player.classId && skill.levelReq <= player.level)
      .map((skill) => skill.id);
  }
  if (player.level >= data.slice.levelRange[1]) player.exp = Math.min(player.exp, expToNext(player.level) - 1);
}

function defeat(player, monsterId, count) {
  const monster = monsterById[monsterId];
  assert(monster, `missing monster ${monsterId}`);
  for (let i = 0; i < count; i += 1) {
    player.kills += 1;
    player.maps.add(monster.mapIds[0]);
    addExp(player, monster.exp);
  }
}

function objectiveMonster(quest) {
  const obj = quest.objective;
  if (obj.type === "kill") return obj.target;
  if (obj.type === "collect") {
    const table = data.drops.find((dropTable) => dropTable.drops.some((drop) => drop.id === obj.target));
    return table?.monsterId;
  }
  if (obj.type === "catch_pet") return petById[obj.target]?.catchFrom;
  return null;
}

function runQuest(player, quest) {
  player.maps.add(quest.mapId);
  const obj = quest.objective;
  if (obj.type === "talk") {
    addExp(player, quest.rewards.exp || 0);
  } else if (obj.type === "kill") {
    defeat(player, obj.target, obj.count);
  } else if (obj.type === "collect") {
    const monsterId = objectiveMonster(quest);
    defeat(player, monsterId, Math.ceil(obj.count / 0.55));
  } else if (obj.type === "catch_pet") {
    const pet = petById[obj.target];
    assert(pet?.base && pet.catchFrom, `catch pet must be runtime ready: ${obj.target}`);
    defeat(player, pet.catchFrom, 4);
    player.pets += 1;
  } else if (obj.type === "train_pet") {
    assert(player.pets > 0, "pet training before capture");
    player.petTraining += 1;
  } else if (obj.type === "allocate_attr") {
    player.allocatedAttr += obj.count;
  } else if (obj.type === "equip_item") {
    const equip = equipmentById[obj.target];
    assert(equip, `missing equipment ${obj.target}`);
    player.equipped.add(equip.slot);
  } else if (obj.type === "dungeon") {
    const dungeon = dungeonById[obj.target];
    assert(dungeon, `missing dungeon ${obj.target}`);
    player.dungeons += 1;
    for (const wave of dungeon.waves) {
      for (const monsterId of wave.monsterIds) {
        defeat(player, monsterId, Math.max(1, Math.ceil(wave.count / wave.monsterIds.length)));
      }
    }
    addExp(player, dungeon.rewards.exp || 0);
  } else if (obj.type === "clear_activity") {
    const activity = activityById[obj.target];
    assert(activity, `missing activity ${obj.target}`);
    if (activity.dungeonId) {
      const dungeon = dungeonById[activity.dungeonId];
      assert(dungeon, `missing activity dungeon ${activity.dungeonId}`);
      player.dungeons += 1;
      for (const wave of dungeon.waves) {
        for (const monsterId of wave.monsterIds) {
          defeat(player, monsterId, Math.max(1, Math.ceil(wave.count / wave.monsterIds.length)));
        }
      }
    } else {
      defeat(player, "tree_demon", activity.target?.count || 12);
    }
    player.activities += 1;
    addExp(player, activity.rewards.exp || 0);
  }
  addExp(player, quest.rewards.exp || 0);
  player.gold += quest.rewards.gold || 0;
  player.completed.push(quest.id);
}

const player = {
  classId: data.slice.classId,
  level: 1,
  exp: 0,
  freeAttr: 0,
  allocatedAttr: 0,
  gold: 180,
  kills: 0,
  completed: [],
  maps: new Set(),
  equipped: new Set(["weapon", "armor"]),
  pets: 0,
  petTraining: 0,
  activities: 0,
  dungeons: 0,
  unlockedSkills: data.skills.filter((skill) => skill.classId === data.slice.classId && skill.levelReq <= 1).map((skill) => skill.id)
};

const main = data.quests.filter((quest) => quest.chain === "main" && quest.levelReq <= data.slice.levelRange[1]);
assert(main.length >= 10, "not enough main quests for 1-20 slice");

for (const quest of main) {
  while (player.level < quest.levelReq) {
    const target = quest.id === "m10" ? "tree_demon" : quest.levelReq >= 12 ? "boar" : "man_eater_flower";
    defeat(player, target, 3);
  }
  runQuest(player, quest);
}

for (const id of data.slice.combat.requiredSkills) {
  assert(player.unlockedSkills.includes(id), `assassin slice did not unlock skill: ${id}`);
  assert(skillById[id].levelReq <= 12, `skill unlock too late for slice: ${id}`);
}

assert(player.classId === "assassin", "playtest must use assassin");
assert(player.level === 20, `vertical slice should stop at level 20, got ${player.level}`);
assert(player.completed.includes("m10"), "playtest must clear flower nest trial");
assert(player.kills >= 80, "playtest needs enough combat exposure");
assert(player.pets >= 1 && player.petTraining >= 1, "playtest must include pet capture and training");
assert(player.activities >= 1, "playtest must include daily/trial activity");
assert(player.equipped.has("weapon"), "playtest must include weapon equipment");
assert(player.maps.has("fangcao") && player.maps.has("yangyuan_mid") && player.maps.has("dungeon_nest"), "playtest must visit core slice maps");

console.table([{
  class: "刺客",
  level: player.level,
  kills: player.kills,
  quests: player.completed.length,
  maps: player.maps.size,
  skills: player.unlockedSkills.length,
  pets: player.pets,
  activities: player.activities,
  dungeons: player.dungeons
}]);
console.log("P2.5 assassin vertical slice player simulation passed");
