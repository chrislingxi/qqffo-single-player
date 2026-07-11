const DATA_FILES = {
  classes: "data/design/classes.json",
  formulas: "data/design/attribute_formulas.json",
  levels: "data/design/levels.json",
  skills: "data/design/skills.json",
  maps: "data/design/maps.json",
  mapScenes: "data/design/map_scene_profiles.json",
  npcs: "data/design/npcs.json",
  monsters: "data/design/monsters.json",
  spawns: "data/design/spawns.json",
  items: "data/design/items.json",
  equipment: "data/design/equipment.json",
  drops: "data/design/drop_tables.json",
  pets: "data/design/pets.json",
  dungeons: "data/design/dungeons.json",
  quests: "data/design/quests.json",
  enhancement: "data/design/enhancement_rules.json",
  activities: "data/design/activities.json",
  advancement: "data/design/advancement.json",
  petTraining: "data/design/pet_training.json",
  ascension: "data/design/ascension.json",
  levelCap110: "data/design/level_cap_110.json",
  lateGrowth: "data/design/late_growth.json",
  fullPetCatalog: "data/design/full_pet_catalog.json",
  petSkills: "data/design/pet_skills.json",
  petGrowth: "data/design/pet_growth.json",
  petFormations: "data/design/pet_formations.json",
  petRuntimeCatalog: "data/design/pet_runtime_catalog.json",
  endgameDungeons: "data/design/endgame_dungeons.json",
  endgameBosses: "data/design/endgame_bosses.json",
  runtimeEndgameDungeons: "data/design/runtime_endgame_dungeons.json",
  endgameMaps: "data/design/endgame_maps.json",
  endgameMaterials: "data/design/endgame_materials.json",
  fullEquipmentCatalog: "data/design/full_equipment_catalog.json",
  fullActivityCatalog: "data/design/full_activity_catalog.json",
  sourceGaps: "data/design/source_gaps.json",
  p3SystemDetails: "data/design/p3_system_details.json",
  qAssets: "assets/game/qstyle/manifest.json"
};

const SAVE_KEY = "ffo_p2_save_v1";
const LEGACY_SAVE_KEYS = ["ffo_p1_save_v1"];
const DATA_VERSION = "p25-assassin-slice-01";
const VERTICAL_SLICE = {
  enabled: true,
  classId: "assassin",
  maxLevel: 20,
  startMapId: "taoyuan_village",
  title: "2.5D 刺客纵切 Demo",
  tagline: "1-20级主线、自动寻路、生态刷怪、连击战斗、宠物与装备闭环"
};
const app = document.querySelector("#app");
let data;
let state;
let canvas;
let ctx;
let lastTime = performance.now();
let renderTimer = 0;
let currentTab = "quest";
let selectedClass = VERTICAL_SLICE.classId;
let logs = [];
let spriteImages = {};

function selectTab(tab) {
  if (!tab) return;
  const changed = currentTab !== tab;
  currentTab = tab;
  if (changed) {
    const body = document.querySelector(".panel-body");
    if (body) body.scrollTop = 0;
  }
}

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pct = (value, max) => `${clamp((value / Math.max(1, max)) * 100, 0, 100)}%`;
const now = () => performance.now() / 1000;

async function loadData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, path]) => [key, await fetch(`${path}?v=${DATA_VERSION}`, { cache: "reload" }).then((res) => res.json())])
  );
  data = Object.fromEntries(entries);
  if (data.runtimeEndgameDungeons) {
    data.maps = [...data.maps, ...(data.runtimeEndgameDungeons.maps || [])];
    data.monsters = [...data.monsters, ...(data.runtimeEndgameDungeons.monsters || [])];
    data.dungeons = [...data.dungeons, ...(data.runtimeEndgameDungeons.dungeons || [])];
  }
  data.classById = byId(data.classes);
  data.mapById = byId(data.maps);
  data.mapSceneById = byId(data.mapScenes);
  data.npcById = byId(data.npcs);
  data.monsterById = byId(data.monsters);
  data.itemById = byId(data.items);
  data.equipmentById = byId(data.equipment);
  data.petById = byId(data.pets);
  data.petCatalogById = byId(data.petRuntimeCatalog.pets || []);
  data.dungeonById = byId(data.dungeons);
  data.questById = byId(data.quests);
  data.activityById = byId(data.activities);
  data.qAssetById = byId(data.qAssets);
  data.skillsByClass = data.skills.reduce((acc, skill) => {
    acc[skill.classId] ||= [];
    acc[skill.classId].push(skill);
    return acc;
  }, {});
  window.__ffoData = data;
  await loadSprites();
}

async function loadSprites() {
  const entries = data.qAssets.filter((asset) => asset.q_asset && asset.q_asset !== "missing").map((asset) => {
    const img = new Image();
    img.src = asset.q_asset;
    spriteImages[asset.id] = img;
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  await Promise.all(entries);
}

function freshState(classId, name) {
  if (VERTICAL_SLICE.enabled) classId = VERTICAL_SLICE.classId;
  const classDef = data.classById[classId];
  const weapon = data.equipment.find((item) => item.classIds.includes(classId) && item.slot === "weapon");
  return {
    createdAt: Date.now(),
    name: name || "幻想者",
    classId,
    level: 1,
    exp: 0,
    gold: 180,
    attr: { ...classDef.base },
    freeAttr: 0,
    skillPoints: 0,
    hp: 0,
    mp: 0,
    mapId: VERTICAL_SLICE.startMapId,
    x: 240,
    y: 260,
    target: null,
    manualUntil: 0,
    autoPath: true,
    autoCombat: true,
    autoSupply: true,
    autoQuest: true,
    inventory: [
      { id: "small_hp", qty: 8 },
      { id: "small_mp", qty: 5 },
      { id: "pet_food", qty: 2 }
    ],
    equipment: {
      weapon: makeEquipment(weapon.id),
      armor: makeEquipment("linen_armor"),
      accessory: null
    },
    progression: {
      firstJob: false,
      ascension: false
    },
    activityDay: todayKey(),
    activityRuns: {},
    activeActivity: null,
    skills: {},
    cooldowns: {},
    buffs: [],
    questProgress: {},
    completedQuests: [],
    activeQuestId: "m1",
    combat: null,
    fx: [],
    dungeon: null,
    pets: [],
    activePetId: null,
    codex: {},
    worldSpawns: [],
    stats: {
      kills: 0,
      deaths: 0,
      dungeons: 0,
      playSeconds: 0
    },
    verticalSlice: VERTICAL_SLICE.enabled ? "assassin_1_20" : null
  };
}

function makeEquipment(id) {
  const base = data.equipmentById[id];
  if (!base) return null;
  return {
    uid: `${id}_${Math.random().toString(36).slice(2, 8)}`,
    id,
    durability: base.durability,
    plus: 0,
    sockets: 0,
    soul: false
  };
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || LEGACY_SAVE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const parsed = JSON.parse(raw);
    if (parsed?.classId && data.classById[parsed.classId] && data.mapById[parsed.mapId]) return migrateState(parsed);
  } catch {
    return null;
  }
  return null;
}

function migrateState(saveData) {
  saveData.progression ||= { firstJob: false, ascension: false };
  saveData.activityDay ||= todayKey();
  saveData.activityRuns ||= {};
  saveData.activeActivity ||= null;
  saveData.manualUntil ||= 0;
  saveData.fx ||= [];
  saveData.worldSpawns ||= [];
  saveData.inventory ||= [];
  saveData.pets ||= [];
  saveData.pets = saveData.pets.filter((pet) => data.petById[pet.id]);
  if (saveData.activePetId && !saveData.pets.some((pet) => pet.uid === saveData.activePetId)) {
    saveData.activePetId = saveData.pets[0]?.uid || null;
  }
  Object.values(saveData.equipment || {}).forEach((equip) => {
    if (!equip) return;
    equip.plus ||= 0;
    equip.sockets ||= 0;
    equip.soul ||= false;
  });
  saveData.pets.forEach((pet) => {
    pet.skillLevel ||= 1;
    pet.training ||= 0;
    pet.circle ||= false;
  });
  return saveData;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetActivityDay() {
  const key = todayKey();
  if (state.activityDay === key) return;
  state.activityDay = key;
  state.activityRuns = {};
  state.activeActivity = null;
  addLog("日常次数已刷新");
}

function initVitals() {
  const stats = getStats();
  state.hp = state.hp > 0 ? clamp(state.hp, 1, stats.maxHp) : stats.maxHp;
  state.mp = state.mp > 0 ? clamp(state.mp, 1, stats.maxMp) : stats.maxMp;
}

function getStats() {
  const classDef = data.classById[state.classId];
  const attr = state.attr;
  const eq = Object.values(state.equipment || {}).filter(Boolean).reduce((sum, equip) => {
    const base = data.equipmentById[equip.id];
    const wear = equip.durability <= 0 ? 0.35 : 1;
    const plusRate = data.enhancement.levels.find((item) => item.plus === (equip.plus || 0))?.statRate || 0;
    Object.entries(base.stats || {}).forEach(([key, value]) => {
      sum[key] = (sum[key] || 0) + Math.floor(value * (1 + plusRate) * wear);
    });
    if (equip.sockets) {
      Object.entries(data.enhancement.socket.bonus).forEach(([key, value]) => {
        sum[key] = (sum[key] || 0) + value * equip.sockets;
      });
    }
    if (equip.soul) {
      Object.entries(data.enhancement.soul.bonus).forEach(([key, value]) => {
        sum[key] = (sum[key] || 0) + value;
      });
    }
    return sum;
  }, {});
  const advanceBonus = ["firstJob", "ascension"].reduce((sum, key) => {
    if (!state.progression?.[key]) return sum;
    Object.entries(data.advancement[key].bonus).forEach(([stat, value]) => {
      sum[stat] = (sum[stat] || 0) + value;
    });
    return sum;
  }, {});
  const passive = learnedSkills().filter((skill) => skill.type === "passive").reduce((sum, skill) => {
    Object.entries(skill.bonus || {}).forEach(([key, value]) => {
      sum[key] = (sum[key] || 0) + value;
    });
    return sum;
  }, {});
  const buff = state.buffs.reduce((sum, buffItem) => {
    Object.entries(buffItem.stats || {}).forEach(([key, value]) => {
      sum[key] = (sum[key] || 0) + value;
    });
    return sum;
  }, {});
  const pet = activePet();
  const petStats = pet ? petBattleStats(pet) : { attack: 0, defense: 0, maxHp: 0 };
  const maxHp = Math.floor(120 + attr.vit * 12 + state.level * classDef.growth.hp + (eq.maxHp || 0) + (passive.maxHp || 0) + (advanceBonus.maxHp || 0) + (petStats.maxHp || 0) * 0.2);
  const maxMp = Math.floor(60 + attr.spi * 8 + attr.int * 3 + state.level * classDef.growth.mp + (eq.maxMp || 0) + (passive.maxMp || 0));
  const attackBase = 8 + attr.str * 2.2 + attr.agi * 0.4 + state.level * classDef.growth.atk + (eq.attack || 0) + (passive.attack || 0) + (advanceBonus.attack || 0) + petStats.attack * 0.18;
  const magicAttackBase = 8 + attr.int * 2.6 + attr.spi * 0.6 + state.level * classDef.growth.matk + (eq.magicAttack || 0) + (passive.magicAttack || 0) + (advanceBonus.magicAttack || 0);
  const defenseBase = 4 + attr.vit * 1.4 + state.level * classDef.growth.def + (eq.defense || 0) + (passive.defense || 0) + (advanceBonus.defense || 0) + petStats.defense * 0.22;
  return {
    maxHp,
    maxMp,
    attack: Math.floor(attackBase * (1 + (buff.attackPct || 0)) + (buff.attack || 0)),
    magicAttack: Math.floor(magicAttackBase * (1 + (buff.magicAttackPct || 0)) + (buff.magicAttack || 0)),
    defense: Math.floor(defenseBase * (1 + (buff.defensePct || 0)) + (buff.defense || 0)),
    hit: Math.floor(82 + attr.agi * 0.45),
    crit: Math.floor(5 + attr.agi * 0.18 + (eq.crit || 0) + (passive.crit || 0) + (advanceBonus.crit || 0) + (buff.crit || 0)),
    dodge: Math.floor(3 + attr.agi * 0.16 + (passive.dodge || 0) + (buff.dodge || 0)),
    attackInterval: Math.max(0.55, classDef.attackInterval - (passive.attackSpeed || 0))
  };
}

function expToNext(level = state.level) {
  const curve = data.levels.expCurve;
  return Math.floor(curve.base * Math.pow(curve.growth, level - 1) + curve.flat * level * level);
}

function learnedSkills() {
  return (data.skillsByClass[state.classId] || []).filter((skill) => state.level >= skill.levelReq);
}

function activeSkills() {
  return learnedSkills().filter((skill) => skill.type === "active");
}

function addLog(text) {
  logs.unshift(text);
  logs = logs.slice(0, 3);
  const wrap = document.querySelector(".float-log");
  if (wrap) wrap.innerHTML = logs.map((item) => `<div>${item}</div>`).join("");
}

function addItem(id, qty = 1) {
  const base = data.equipmentById[id];
  if (base) {
    state.inventory.push({ equip: makeEquipment(id), qty: 1 });
    addLog(`获得装备：${base.name}`);
    return;
  }
  const found = state.inventory.find((item) => item.id === id && !item.equip);
  if (found) found.qty += qty;
  else state.inventory.push({ id, qty });
  addLog(`获得：${itemName(id)} x${qty}`);
}

function removeItem(id, qty = 1) {
  const found = state.inventory.find((item) => item.id === id && !item.equip);
  if (!found || found.qty < qty) return false;
  found.qty -= qty;
  if (found.qty <= 0) state.inventory = state.inventory.filter((item) => item !== found);
  return true;
}

function itemCount(id) {
  return state.inventory.filter((item) => item.id === id).reduce((sum, item) => sum + item.qty, 0);
}

function itemName(id) {
  return data.itemById[id]?.name || data.equipmentById[id]?.name || id;
}

function addExp(amount) {
  state.exp += Math.floor(amount);
  const maxLevel = VERTICAL_SLICE.enabled ? VERTICAL_SLICE.maxLevel : data.levels.maxLevel;
  while (state.level < maxLevel && state.exp >= expToNext()) {
    state.exp -= expToNext();
    state.level += 1;
    state.freeAttr += data.levels.attributePointsPerLevel;
    state.skillPoints += data.levels.skillPointsPerLevel;
    const stats = getStats();
    state.hp = stats.maxHp;
    state.mp = stats.maxMp;
    addLog(`升级到 ${state.level} 级`);
  }
  if (VERTICAL_SLICE.enabled && state.level >= VERTICAL_SLICE.maxLevel) {
    state.exp = Math.min(state.exp, expToNext() - 1);
  }
}

function currentMap() {
  return data.mapById[state.mapId] || data.mapById.taoyuan_village || data.maps[0];
}

function questProgress(quest) {
  state.questProgress[quest.id] ||= 0;
  return state.questProgress[quest.id];
}

function activeQuest() {
  if (state.activeQuestId && !state.completedQuests.includes(state.activeQuestId)) return data.questById[state.activeQuestId];
  const next = data.quests.find((quest) => canAcceptQuest(quest));
  state.activeQuestId = next?.id || null;
  return next || null;
}

function canAcceptQuest(quest) {
  if (state.completedQuests.includes(quest.id)) return false;
  if (state.level < quest.levelReq) return false;
  if (quest.classId && quest.classId !== state.classId) return false;
  if (quest.chain === "main") {
    const previous = data.quests.find((item) => item.next === quest.id);
    return !previous || state.completedQuests.includes(previous.id);
  }
  return true;
}

function guideQuest(quest = activeQuest()) {
  if (!quest) {
    const monster = monsterForLevel();
    const spawn = spawnForMonster(monster.id);
    setTarget(spawn.mapId, spawn.x, spawn.y, `练级：${monster.name}`, { questWarp: true });
    return;
  }
  const objective = quest.objective;
  if (objective.type === "talk") {
    const npc = data.npcById[objective.target];
    setTarget(npc.mapId, npc.x, npc.y, `拜访 ${npc.name}`, { questWarp: true });
  } else if (objective.type === "kill" || objective.type === "kill_any") {
    const targetMonster = objective.type === "kill_any" ? monsterForLevel() : data.monsterById[objective.target];
    const spawn = spawnForMonster(targetMonster.id);
    setTarget(spawn.mapId, spawn.x, spawn.y, `讨伐 ${targetMonster.name}`, { questWarp: true });
  } else if (objective.type === "collect") {
    const drop = data.drops.find((table) => table.drops.some((item) => item.id === objective.target));
    const spawn = spawnForMonster(drop?.monsterId || monsterForLevel().id);
    setTarget(spawn.mapId, spawn.x, spawn.y, `收集 ${itemName(objective.target)}`, { questWarp: true });
  } else if (objective.type === "catch_pet") {
    const pet = data.petById[objective.target];
    const spawn = spawnForMonster(pet.catchFrom);
    setTarget(spawn.mapId, spawn.x, spawn.y, `捕捉 ${pet.name}`, { questWarp: true });
  } else if (objective.type === "dungeon") {
    enterDungeon(objective.target);
  } else if (objective.type === "learn_skill") {
    openGuidedPanel("role", `学习技能：${skillName(objective.target)}`);
  } else if (objective.type === "allocate_attr") {
    openGuidedPanel("role", "分配属性点");
    autoAllocateQuestAttr(quest);
  } else if (objective.type === "equip_item") {
    openGuidedPanel("bag", `装备：${itemName(objective.target)}`);
    autoEquipQuestItem(objective.target);
  } else if (objective.type === "enhance_item") {
    openGuidedPanel("bag", "加工武器");
    if (!questProgress(quest)) enhanceEquipped(objective.slot || "weapon");
  } else if (objective.type === "socket_item") {
    openGuidedPanel("bag", "打孔镶嵌");
    if (!questProgress(quest)) socketEquipped(objective.slot || "weapon");
  } else if (objective.type === "train_pet") {
    openGuidedPanel("pet", "培育宠物");
    if (!questProgress(quest)) trainActivePet();
  } else if (objective.type === "use_pet_skill_pill") {
    openGuidedPanel("pet", "宠物技能丸");
    if (!questProgress(quest)) skillActivePet();
  } else if (objective.type === "activate_pet_circle") {
    openGuidedPanel("pet", "宠物法阵");
    if (!questProgress(quest)) activatePetCircle();
  } else if (objective.type === "clear_activity") {
    openGuidedPanel("activity", `日常：${data.activityById[objective.target]?.name || objective.target}`);
    if (!state.activeActivity) runActivity(objective.target);
  }
}

function openGuidedPanel(tab, label) {
  currentTab = tab;
  document.querySelector(".hud")?.classList.toggle("open", true);
  state.target = null;
  addLog(label);
}

function skillName(id) {
  return data.skills.find((skill) => skill.id === id)?.name || id;
}

function autoAllocateQuestAttr(quest) {
  const count = quest.objective.count || 1;
  while (state.freeAttr > 0 && questProgress(quest) < count) {
    const key = recommendedAttrKey();
    state.attr[key] += 1;
    state.freeAttr -= 1;
    state.questProgress[quest.id] = questProgress(quest) + 1;
  }
  initVitals();
}

function recommendedAttrKey() {
  const classDef = data.classById[state.classId];
  const entries = Object.entries(classDef.autoPointPerLevel || {});
  const [key] = entries.sort((a, b) => b[1] - a[1])[0] || ["str"];
  return key === "dex" ? "agi" : key;
}

function autoEquipQuestItem(itemId) {
  const index = state.inventory.findIndex((item) => item.equip?.id === itemId);
  if (index >= 0) equipFromBag(index);
}

function setTarget(mapId, x, y, label = "目的地", options = {}) {
  if (options.manual) state.manualUntil = now() + 8;
  if (state.mapId !== mapId) {
    const from = currentMap()?.name || state.mapId;
    state.mapId = mapId;
    const map = currentMap();
    state.x = clamp(120, 0, map.size[0]);
    state.y = clamp(120, 0, map.size[1]);
    state.combat = null;
    addLog(options.questWarp ? `任务传送：${from} -> ${map.name}` : `传送至 ${map.name}`);
  }
  const safe = nearestWalkable(mapId, x, y);
  state.target = { mapId, x: safe.x, y: safe.y, label };
  ensureWorldSpawns();
}

function spawnForMonster(monsterId) {
  return data.spawns.find((spawn) => spawn.monsterIds.includes(monsterId)) || data.spawns[0];
}

function spawnInstancesForMap(mapId = state.mapId) {
  ensureWorldSpawns();
  return (state.worldSpawns || []).filter((spawn) => spawn.mapId === mapId && spawn.alive !== false);
}

function ensureWorldSpawns() {
  state.worldSpawns ||= [];
  const liveKeys = new Set(state.worldSpawns.map((spawn) => spawn.uid));
  data.spawns.forEach((zone) => {
    const desired = Math.max(3, Math.min(7, zone.maxAlive || Math.ceil((zone.radius || 180) / 72)));
    for (let i = 0; i < desired; i += 1) {
      const uid = `${zone.id}_${i}`;
      if (liveKeys.has(uid)) continue;
      state.worldSpawns.push(makeWorldSpawn(zone, i));
    }
  });
  const t = now();
  state.worldSpawns.forEach((spawn) => {
    if (spawn.alive === false && t >= (spawn.respawnAt || 0)) {
      const zone = data.spawns.find((item) => item.id === spawn.zoneId);
      if (!zone) return;
      Object.assign(spawn, makeWorldSpawn(zone, spawn.index));
    }
  });
}

function makeWorldSpawn(zone, index) {
  const angle = (index * 2.399 + zone.x * 0.01) % (Math.PI * 2);
  const ring = 0.28 + ((index * 37) % 70) / 100;
  const radius = (zone.radius || 180) * ring;
  const map = data.mapById[zone.mapId] || data.maps[0];
  const monsterId = zone.monsterIds[index % zone.monsterIds.length];
  return {
    uid: `${zone.id}_${index}`,
    zoneId: zone.id,
    index,
    mapId: zone.mapId,
    monsterId,
    x: clamp(zone.x + Math.cos(angle) * radius, 60, map.size[0] - 60),
    y: clamp(zone.y + Math.sin(angle) * radius * 0.62, 80, map.size[1] - 60),
    homeX: zone.x,
    homeY: zone.y,
    radius: zone.radius || 180,
    respawn: zone.respawn || 10,
    alive: true,
    phase: Math.random() * Math.PI * 2
  };
}

function monsterForLevel() {
  const candidates = data.monsters.filter((monster) => monster.type === "normal" && monster.level <= state.level + 2);
  return candidates.at(-1) || data.monsters[0];
}

function distanceTo(x, y) {
  return Math.hypot(state.x - x, state.y - y);
}

function tick(dt) {
  if (!state) return;
  resetActivityDay();
  ensureWorldSpawns();
  tickWorldSpawns(dt);
  state.stats.playSeconds += dt;
  state.buffs = state.buffs.filter((buff) => buff.until > now());
  state.fx = (state.fx || []).map((fx) => ({ ...fx, age: fx.age + dt, y: fx.y - fx.vy * dt })).filter((fx) => fx.age < fx.life);
  if (state.autoQuest && !state.combat && !state.dungeon && !state.target && now() > (state.manualUntil || 0)) guideQuest();
  tickMovement(dt);
  tickAutoSupply();
  tickDungeonMechanics();
  tickCombat(dt);
  tickQuestCompletion();
  renderTimer += dt;
  if (renderTimer > 0.35) {
    renderTimer = 0;
    renderGame();
    save();
  }
}

function tickMovement(dt) {
  if (!state.autoPath || !state.target || state.combat) return;
  const speed = 170;
  const dx = state.target.x - state.x;
  const dy = state.target.y - state.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) {
    state.x = state.target.x;
    state.y = state.target.y;
    state.target = null;
    return;
  }
  const step = Math.min(dist, speed * dt);
  const nx = state.x + (dx / dist) * step;
  const ny = state.y + (dy / dist) * step;
  if (isWalkable(state.mapId, nx, ny)) {
    state.x = nx;
    state.y = ny;
  } else {
    const safe = nearestWalkable(state.mapId, nx, ny);
    state.x = safe.x;
    state.y = safe.y;
    state.target = null;
  }
}

function isWalkable(mapId, x, y) {
  const map = data.mapById[mapId] || currentMap();
  const profile = currentSceneProfile(map);
  if (x < 42 || y < 56 || x > map.size[0] - 42 || y > map.size[1] - 36) return false;
  if (profile.water && profile.theme === "bamboo_water" && x < map.size[0] * 0.34 && y < map.size[1] * 0.38) return false;
  if (profile.water && /spirit/.test(profile.theme || "") && x < map.size[0] * 0.22 && y < map.size[1] * 0.28) return false;
  if (["tower", "nest", "spirit_hall", "dragon_relic"].includes(profile.theme) && (x < 86 || y < 86 || x > map.size[0] - 86 || y > map.size[1] - 78)) return false;
  return true;
}

function nearestWalkable(mapId, x, y) {
  const map = data.mapById[mapId] || currentMap();
  let nx = clamp(x, 60, map.size[0] - 60);
  let ny = clamp(y, 76, map.size[1] - 58);
  if (isWalkable(mapId, nx, ny)) return { x: nx, y: ny };
  const center = { x: map.size[0] * 0.52, y: map.size[1] * 0.55 };
  for (let i = 0; i < 24; i += 1) {
    nx += (center.x - nx) * 0.18;
    ny += (center.y - ny) * 0.18;
    if (isWalkable(mapId, nx, ny)) return { x: nx, y: ny };
  }
  return center;
}

function tickAutoSupply() {
  if (!state.autoSupply) return;
  const stats = getStats();
  if (state.hp / stats.maxHp < 0.45) {
    if (removeItem("small_hp")) {
      state.hp = clamp(state.hp + 260, 0, stats.maxHp);
      addLog("自动使用红药");
    } else if (state.gold >= 20) {
      state.gold -= 20;
      state.hp = clamp(state.hp + 220, 0, stats.maxHp);
      addLog("自动补给红药");
    }
  }
  if (state.mp / stats.maxMp < 0.35) {
    if (removeItem("small_mp")) {
      state.mp = clamp(state.mp + 180, 0, stats.maxMp);
      addLog("自动使用蓝药");
    } else if (state.gold >= 24) {
      state.gold -= 24;
      state.mp = clamp(state.mp + 150, 0, stats.maxMp);
      addLog("自动补给蓝药");
    }
  }
}

function tickCombat(dt) {
  if (!state.combat && state.autoCombat && !state.target) {
    maybeStartEncounter();
  }
  if (!state.combat) return;
  const combat = state.combat;
  tickCombatPosition(dt, combat);
  combat.elapsed += dt;
  combat.enemy.debuffs = (combat.enemy.debuffs || []).filter((debuff) => debuff.until > now());
  combat.playerTimer -= dt;
  combat.enemyTimer -= dt;
  combat.petTimer -= dt;
  if (combat.playerTimer <= 0) {
    playerAttack();
    combat.playerTimer = getStats().attackInterval;
  }
  if (combat.petTimer <= 0 && activePet()) {
    petAttack();
    combat.petTimer = 2.1;
  }
  if (combat.enemyTimer <= 0) {
    enemyAttack();
    combat.enemyTimer = combat.enemy.type === "boss" ? 1.25 : 1.55;
  }
  if (combat.enemy.hp <= 0) finishEnemy();
  if (state.hp <= 0) revive();
}

function tickCombatPosition(dt, combat) {
  if (!combat?.enemy) return;
  const desiredGap = combat.enemy.type === "boss" ? 92 : 74;
  const targetX = combat.enemyX - desiredGap;
  const targetY = combat.enemyY + 8;
  const dx = targetX - state.x;
  const dy = targetY - state.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return;
  const speed = 210;
  const step = Math.min(dist, speed * dt);
  const nx = state.x + (dx / dist) * step;
  const ny = state.y + (dy / dist) * step;
  if (isWalkable(state.mapId, nx, ny)) {
    state.x = nx;
    state.y = ny;
  }
}

function tickDungeonMechanics() {
  if (!state.dungeon?.timerSeconds || state.dungeon.done) return;
  const elapsed = now() - (state.dungeon.startedAt || now());
  state.dungeon.timeLeft = Math.max(0, state.dungeon.timerSeconds - elapsed);
  if (state.dungeon.timeLeft <= 0) failDungeon("限时结束，试炼失败");
}

function maybeStartEncounter() {
  const spawn = spawnInstancesForMap()
    .sort((a, b) => distanceTo(a.x, a.y) - distanceTo(b.x, b.y))[0];
  if (!spawn || distanceTo(spawn.x, spawn.y) > 92) return;
  const quest = activeQuest();
  const desired = questMonsterTarget(quest);
  const zone = data.spawns.find((item) => item.id === spawn.zoneId);
  if (desired && zone?.monsterIds.includes(desired)) {
    const desiredSpawn = spawnInstancesForMap().find((item) => item.zoneId === zone.id && item.monsterId === desired);
    if (desiredSpawn) return startCombat(data.monsterById[desired], desiredSpawn);
  }
  startCombat(data.monsterById[spawn.monsterId], spawn);
}

function tickWorldSpawns(dt) {
  const t = now();
  (state.worldSpawns || []).forEach((spawn) => {
    if (spawn.alive === false) return;
    const sway = Math.sin(t * 0.45 + spawn.phase) * 0.18;
    spawn.x = clamp(spawn.x + Math.cos(spawn.phase + t * 0.23) * dt * 4 * sway, spawn.homeX - spawn.radius, spawn.homeX + spawn.radius);
    spawn.y = clamp(spawn.y + Math.sin(spawn.phase + t * 0.21) * dt * 3 * sway, spawn.homeY - spawn.radius * 0.62, spawn.homeY + spawn.radius * 0.62);
  });
}

function questMonsterTarget(quest) {
  if (!quest) return null;
  if (quest.objective.type === "kill") return quest.objective.target;
  if (quest.objective.type === "collect") {
    return data.drops.find((table) => table.drops.some((drop) => drop.id === quest.objective.target))?.monsterId;
  }
  if (quest.objective.type === "catch_pet") return data.petById[quest.objective.target]?.catchFrom;
  return null;
}

function startCombat(monster, spawn = null) {
  const enemyX = spawn?.x || state.x + 138;
  const enemyY = spawn?.y || state.y - 4;
  const dist = Math.hypot(state.x - enemyX, state.y - enemyY);
  if (dist < 58) {
    state.x = clamp(enemyX - 78, 60, currentMap().size[0] - 60);
    state.y = clamp(enemyY + 8, 76, currentMap().size[1] - 58);
  }
  state.combat = {
    enemy: { ...monster, maxHp: monster.hp, hp: monster.hp },
    spawnUid: spawn?.uid || null,
    enemyX,
    enemyY,
    playerTimer: 0.2,
    enemyTimer: 1.2,
    petTimer: 0.8,
    playerActionUntil: 0,
    enemyActionUntil: 0,
    petActionUntil: 0,
    lastSkillName: "",
    skillLabelUntil: 0,
    elapsed: 0
  };
  state.codex[monster.id] = true;
  addLog(`遭遇 ${monster.name}`);
  addFx("", state.x + 84, state.y - 46, "#ffe08a", "ring");
}

function bestSkill() {
  const skills = activeSkills().filter((skill) => {
    if (skill.target === "heal") return state.hp / getStats().maxHp < 0.62;
    return skill.power > 0 || skill.buff;
  });
  const ready = skills.filter((skill) => (state.cooldowns[skill.id] || 0) <= now() && state.mp >= skill.mp);
  return ready.sort((a, b) => (b.levelReq + b.power * 10) - (a.levelReq + a.power * 10))[0] || null;
}

function playerAttack() {
  const combat = state.combat;
  const stats = getStats();
  const skill = bestSkill();
  if (skill) {
    castSkill(skill);
  } else {
    let damage = Math.max(4, Math.floor(stats.attack - enemyDefenseValue(combat.enemy) * 0.38));
    const crit = Math.random() * 100 < stats.crit;
    if (crit) damage = Math.floor(damage * 1.5);
    combat.enemy.hp -= damage;
    combat.playerActionUntil = now() + 0.22;
    combat.lastSkillName = "";
    markEnemyHit("attack");
    const point = combatTextPoint();
    addFx(`${crit ? "暴击 " : ""}-${damage}`, point.x, point.y, crit ? "#ffdc5e" : "#fff5d6", crit ? "crit" : "damage");
  }
  wearEquipment();
}

function manualSkill(skillId) {
  const skill = learnedSkills().find((item) => item.id === skillId);
  if (!skill) return;
  state.autoCombat = true;
  if (!state.combat) maybeStartEncounter();
  if (!state.combat) {
    addLog("附近没有可攻击目标");
    return;
  }
  castSkill(skill);
  wearEquipment();
  renderGame();
}

function castSkill(skill) {
  const combat = state.combat;
  const stats = getStats();
  if ((state.cooldowns[skill.id] || 0) > now()) return addLog(`${skill.name} 冷却中`);
  if (state.mp < skill.mp) return addLog("法力不足");
  state.mp -= skill.mp;
  state.cooldowns[skill.id] = now() + skill.cooldown;
  if (skill.target === "heal") {
    const heal = Math.floor(stats[skill.stat] * skill.power + 90);
    state.hp = clamp(state.hp + heal, 0, stats.maxHp);
    addLog(`${skill.name} +${heal}`);
    addFx(`+${heal}`, state.x, state.y - 70, "#85ef91", "heal");
    addFx("", state.x, state.y - 18, "#fff2a6", "light");
    addFx("", state.x, state.y + 10, "#85ef91", "rune");
    return;
  }
  if (skill.buff) {
    const { duration, ...buffStats } = skill.buff;
    state.buffs.push({ name: skill.name, stats: buffStats, until: now() + duration });
    addLog(`施放 ${skill.name}`);
    state.combat.playerActionUntil = now() + 0.18;
    state.combat.lastSkillName = skill.name;
    state.combat.skillLabelUntil = now() + 0.75;
    addFx(skill.name, state.x, state.y - 70, "#bde8ff", "skill");
    addFx("", state.x, state.y - 18, skillColor(skill), "poisonTrail");
    addFx("", state.x, state.y + 10, "#fff2a6", "rune");
    return;
  }
  const enemyDefense = enemyDefenseValue(combat.enemy);
  let damage = Math.max(6, Math.floor(stats[skill.stat] * skill.power - enemyDefense * 0.45));
  const crit = Math.random() * 100 < stats.crit;
  if (crit) damage = Math.floor(damage * 1.6);
  if (skill.hits) damage *= skill.hits;
  if (skill.target === "aoe") damage = Math.floor(damage * 1.22);
  combat.enemy.hp -= damage;
  combat.playerActionUntil = now() + 0.28;
  combat.lastSkillName = skill.name;
  combat.skillLabelUntil = now() + 0.75;
  markEnemyHit("skill");
  if (skill.debuff) {
    const { duration, ...debuffStats } = skill.debuff;
    combat.enemy.debuffs ||= [];
    combat.enemy.debuffs.push({ name: skill.name, stats: debuffStats, until: now() + duration });
    const point = combatTextPoint();
    addFx("破防", point.x, point.y - 18, "#bde8ff", "status");
  }
  if (skill.id === "qingli_yiji") {
    combat.enemy.stunnedUntil = now() + 0.8;
    addFx("眩晕", point.x, point.y - 34, "#fff08a", "stun");
    addFx("", state.x + 55, state.y - 18, "#d9b2ff", "shadowDash");
  }
  if (skill.id === "juji") {
    combat.enemy.rootedUntil = now() + 1.0;
    addFx("定身", point.x, point.y - 34, "#aee8ff", "status");
    addFx("", state.x + 92, state.y - 42, "#bde8ff", "projectile");
  }
  addLog(`${skill.name} -${damage}`);
  const hitCount = skill.hits || (skill.target === "aoe" ? 2 : 1);
  const point = combatTextPoint();
  for (let i = 0; i < hitCount; i += 1) {
    const shownDamage = Math.max(1, Math.floor(damage / hitCount));
    addFx(`${i === 0 ? skill.name : "连击"} ${crit ? "暴击 " : ""}-${shownDamage}`, point.x + i * 14, point.y - i * 14, crit ? "#ffdc5e" : "#ffe08a", crit ? "crit" : "damage");
  }
  addFx("", state.x + 82, state.y - 32, skillColor(skill), skillEffectType(skill));
  if (skill.target === "aoe") addFx("", state.x + 126, state.y - 2, skillColor(skill), "rune");
}

function petAttack() {
  const pet = activePet();
  const petStats = petBattleStats(pet);
  const damage = Math.max(6, Math.floor(petStats.attack * 0.85 - enemyDefenseValue(state.combat.enemy) * 0.2));
  state.combat.enemy.hp -= damage;
  state.combat.petActionUntil = now() + 0.24;
  markEnemyHit("pet");
  addLog(`${pet.name} ${pet.skill} -${damage}`);
  const point = combatTextPoint();
  addFx(`宠物 -${damage}`, point.x - 12, point.y + 20, "#cbe9ff", "damage");
  addFx("", point.x - 30, point.y + 40, "#cbe9ff", "petClaw");
}

function combatTextPoint() {
  const combat = state.combat;
  return {
    x: (combat?.enemyX || state.x + 138) + 74,
    y: (combat?.enemyY || state.y) - 66
  };
}

function markEnemyHit(kind) {
  if (!state.combat?.enemy) return;
  state.combat.enemy.hitFlash = now() + 0.18;
  state.combat.enemyActionUntil = now() + 0.2;
  addFx("", state.x + 136, state.y - 12, kind === "skill" ? "#ffe08a" : "#fff1ce", kind === "pet" ? "impact" : "slash");
}

function skillColor(skill) {
  if (/火|焰|炎/.test(skill.name)) return "#ff8b45";
  if (/冰|霜|寒/.test(skill.name)) return "#8fd7ff";
  if (/毒|淬/.test(skill.name)) return "#9cff80";
  if (/治|祝|光/.test(skill.name)) return "#fff2a6";
  return "#d9b2ff";
}

function skillEffectType(skill) {
  if (/火|焰|炎/.test(skill.name)) return "flame";
  if (/冰|霜|寒/.test(skill.name)) return "ice";
  if (/毒|淬/.test(skill.name)) return "poison";
  if (/治|祝|光/.test(skill.name)) return "light";
  if (/枪|刺|穿/.test(skill.name)) return "spear";
  if (/剑|斩|击/.test(skill.name)) return "slash";
  return skill.target === "aoe" ? "ring" : "projectile";
}

function enemyDefenseValue(enemy) {
  const debuffs = (enemy.debuffs || []).reduce((sum, debuff) => {
    Object.entries(debuff.stats || {}).forEach(([key, value]) => {
      sum[key] = (sum[key] || 0) + value;
    });
    return sum;
  }, {});
  return Math.max(0, Math.floor(enemy.defense * (1 + (debuffs.defensePct || 0)) + (debuffs.defense || 0)));
}

function enemyAttack() {
  if ((state.combat.enemy.stunnedUntil || 0) > now()) {
    addFx("眩晕中", state.combat.enemyX, state.combat.enemyY - 78, "#fff08a", "status");
    return;
  }
  const stats = getStats();
  const enemy = state.combat.enemy;
  if (Math.random() * 100 < stats.dodge) {
    addLog("闪避攻击");
    addFx("闪避", state.x, state.y - 70, "#bde8ff", "status");
    return;
  }
  const damage = Math.max(5, Math.floor(enemy.attack - stats.defense * 0.42));
  state.hp -= damage;
  state.hitFlash = now() + 0.18;
  state.combat.enemyActionUntil = now() + 0.22;
  addFx(`-${damage}`, state.x - 8, state.y - 68, "#ff8d77", "hit");
}

function finishEnemy() {
  const enemy = state.combat.enemy;
  const spawnUid = state.combat.spawnUid;
  const deadSpawn = spawnUid ? state.worldSpawns.find((spawn) => spawn.uid === spawnUid) : null;
  if (deadSpawn) {
    deadSpawn.alive = false;
    deadSpawn.respawnAt = now() + (deadSpawn.respawn || 10);
  }
  state.stats.kills += 1;
  addExp(enemy.exp);
  state.gold += Math.floor(enemy.level * 4 + Math.random() * enemy.level * 4);
  rollDrops(enemy.id);
  progressKill(enemy);
  progressActivityKill(enemy);
  progressPetCatch(enemy);
  feedPetExp(enemy.exp);
  if (state.dungeon) advanceDungeon();
  addFx(`${enemy.name} 击破`, state.x + 88, state.y - 58, "#ffd36e", "drop");
  addFx("", state.x + 138, state.y + 18, "#ffd36e", "burst");
  state.combat = null;
}

function rollDrops(monsterId) {
  const table = data.drops.find((item) => item.monsterId === monsterId);
  if (!table) return;
  table.drops.forEach((drop) => {
    if (Math.random() < drop.chance) {
      addItem(drop.id, 1);
      progressCollect(drop.id);
      addFx(`掉落 ${itemName(drop.id)}`, state.x + 110, state.y - 18, "#f7d46c", "drop");
      addFx("", state.x + 138, state.y + 16, "#f8d46a", "beam");
    }
  });
}

function addFx(text, x, y, color = "#fff7dc", type = "status") {
  state.fx ||= [];
  if (text) {
    const near = state.fx.filter((fx) => fx.text && Math.abs(fx.x - x) < 96 && Math.abs(fx.y - y) < 52 && fx.age < 0.7).length;
    x += (near % 3) * 18;
    y -= near * 16;
  }
  state.fx.push({
    text,
    x,
    y,
    color,
    type,
    age: 0,
    life: ["drop", "beam", "burst", "ring", "projectile", "aura", "rune", "flame", "ice", "poison", "light", "spear", "petClaw", "shadowDash", "poisonTrail", "stun"].includes(type) ? 1.8 : 1.15,
    vy: type === "drop" ? 16 : 28
  });
  state.fx = state.fx.slice(-18);
}

function progressKill(enemy) {
  const quest = activeQuest();
  if (!quest) return;
  const obj = quest.objective;
  if ((obj.type === "kill" && obj.target === enemy.id) || obj.type === "kill_any") {
    state.questProgress[quest.id] = questProgress(quest) + 1;
  }
}

function progressCollect(itemId) {
  const quest = activeQuest();
  if (!quest || quest.objective.type !== "collect" || quest.objective.target !== itemId) return;
  state.questProgress[quest.id] = Math.min(quest.objective.count, itemCount(itemId));
}

function progressPetCatch(enemy) {
  const quest = activeQuest();
  if (!quest || quest.objective.type !== "catch_pet") return;
  const petDef = data.petById[quest.objective.target];
  if (petDef.catchFrom !== enemy.id || state.level < petDef.levelReq) return;
  if (Math.random() < 0.35 || !state.pets.length) {
    const pet = {
      uid: `${petDef.id}_${Date.now()}`,
      id: petDef.id,
      name: petDef.name,
      level: 1,
      exp: 0,
      trust: 45
    };
    state.pets.push(pet);
    state.activePetId = pet.uid;
    state.questProgress[quest.id] = 1;
    addLog(`捕捉宠物：${petDef.name}`);
  }
}

function feedPetExp(exp) {
  const pet = activePet();
  if (!pet) return;
  pet.exp += Math.floor(exp * 0.55);
  const need = pet.level * pet.level * 45 + 80;
  if (pet.exp >= need) {
    pet.exp -= need;
    pet.level += 1;
    pet.trust = clamp(pet.trust + 1, 0, 100);
    addLog(`${pet.name} 升到 ${pet.level} 级`);
  }
}

function activePet() {
  return state.pets.find((pet) => pet.uid === state.activePetId) || null;
}

function petBattleStats(pet) {
  const base = data.petById[pet.id];
  const skillLevel = pet.skillLevel || 1;
  const circle = pet.circle ? data.petTraining.circle.bonus : {};
  return {
    maxHp: base.base.hp + pet.level * 16 + (circle.maxHp || 0),
    maxMp: 34 + pet.level * 7 + Math.floor(pet.trust / 5),
    attack: base.base.attack + pet.level * 4 + Math.floor(pet.trust / 10) + (skillLevel - 1) * data.petTraining.skillPill.attackBonusPerLevel + (circle.attack || 0),
    defense: base.base.defense + pet.level * 2 + (skillLevel - 1) * data.petTraining.skillPill.defenseBonusPerLevel,
    hit: 60 + pet.level * 2 + Math.floor(pet.trust / 4),
    magicAttack: Math.floor(base.base.attack * 0.55 + pet.level * 3 + (base.growthType === "spirit" ? 18 : 0)),
    magicDefense: Math.floor(base.base.defense * 1.3 + pet.level * 2 + (base.growthType === "spirit" ? 12 : 0))
  };
}

function wearEquipment() {
  Object.values(state.equipment).forEach((equip) => {
    if (!equip) return;
    equip.durability = Math.max(0, equip.durability - 0.015);
  });
}

function revive() {
  if (state.dungeon && (state.dungeon.revivesLeft || 0) > 0) {
    state.stats.deaths += 1;
    state.dungeon.revivesLeft -= 1;
    state.combat = null;
    const stats = getStats();
    state.hp = Math.floor(stats.maxHp * 0.55);
    state.mp = Math.floor(stats.maxMp * 0.45);
    state.x = 170;
    state.y = 300;
    addLog(`副本复活，剩余 ${state.dungeon.revivesLeft} 次`);
    setTimeout(spawnDungeonEnemy, 800);
    return;
  }
  if (state.dungeon) {
    failDungeon("复活次数耗尽，试炼失败");
    return;
  }
  state.stats.deaths += 1;
  state.gold = Math.max(0, state.gold - Math.floor(state.level * 12));
  state.mapId = "longcheng";
  state.x = 360;
  state.y = 320;
  state.combat = null;
  state.dungeon = null;
  const stats = getStats();
  state.hp = Math.floor(stats.maxHp * 0.6);
  state.mp = Math.floor(stats.maxMp * 0.55);
  addLog("已在龙城复活");
}

function failDungeon(reason) {
  const dungeon = data.dungeonById[state.dungeon?.id];
  state.stats.deaths += 1;
  state.combat = null;
  state.dungeon = null;
  state.mapId = dungeon?.entryMap || "longcheng";
  state.x = 240;
  state.y = 280;
  const stats = getStats();
  state.hp = Math.floor(stats.maxHp * 0.6);
  state.mp = Math.floor(stats.maxMp * 0.5);
  addLog(reason);
}

function tickQuestCompletion() {
  const quest = activeQuest();
  if (!quest) return;
  const obj = quest.objective;
  if (obj.type === "talk") {
    const npc = data.npcById[obj.target];
    if (state.mapId === npc.mapId && distanceTo(npc.x, npc.y) < 18) {
      state.questProgress[quest.id] = 1;
    }
  }
  if (obj.type === "collect") {
    state.questProgress[quest.id] = Math.min(obj.count, itemCount(obj.target));
  }
  if (obj.type === "learn_skill") {
    state.questProgress[quest.id] = learnedSkills().some((skill) => skill.id === obj.target) ? obj.count : 0;
  }
  if (obj.type === "equip_item") {
    state.questProgress[quest.id] = Object.values(state.equipment || {}).some((equip) => equip?.id === obj.target) ? obj.count : 0;
  }
  if (obj.type === "enhance_item") {
    const equip = state.equipment[obj.slot || "weapon"];
    state.questProgress[quest.id] = (equip?.plus || 0) >= (obj.plus || 1) ? obj.count : 0;
  }
  if (obj.type === "socket_item") {
    const equip = state.equipment[obj.slot || "weapon"];
    state.questProgress[quest.id] = (equip?.sockets || 0) >= (obj.sockets || 1) ? obj.count : 0;
  }
  if (obj.type === "train_pet") {
    const pet = activePet();
    state.questProgress[quest.id] = (pet?.training || 0) >= (obj.training || 1) ? obj.count : 0;
  }
  if (obj.type === "use_pet_skill_pill") {
    const pet = activePet();
    state.questProgress[quest.id] = (pet?.skillLevel || 1) >= (obj.skillLevel || 2) ? obj.count : 0;
  }
  if (obj.type === "activate_pet_circle") {
    state.questProgress[quest.id] = activePet()?.circle ? obj.count : 0;
  }
  if (obj.type === "clear_activity") {
    state.questProgress[quest.id] = (state.activityRuns[obj.target] || 0) > 0 && !state.activeActivity ? obj.count : 0;
  }
  if (questProgress(quest) >= obj.count) completeQuest(quest);
}

function completeQuest(quest) {
  state.completedQuests.push(quest.id);
  state.questProgress[quest.id] = quest.objective.count;
  const reward = quest.rewards || {};
  if (reward.exp) addExp(reward.exp);
  if (reward.gold) state.gold += reward.gold;
  (reward.items || []).forEach((id) => addItem(id, 1));
  addLog(`完成任务：${quest.title}`);
  if (quest.next && state.level >= data.questById[quest.next].levelReq) state.activeQuestId = quest.next;
  else state.activeQuestId = null;
}

function enterDungeon(id) {
  const dungeon = data.dungeonById[id];
  if (!dungeon || state.level < dungeon.levelReq) {
    addLog("等级不足，暂不能进入副本");
    return;
  }
  state.mapId = id;
  state.x = 170;
  state.y = 300;
  state.target = null;
  state.dungeon = {
    id,
    waveIndex: 0,
    remaining: dungeon.waves[0].count,
    startedAt: now(),
    timerSeconds: dungeon.mechanics?.timer_seconds || null,
    timeLeft: dungeon.mechanics?.timer_seconds || null,
    revivesLeft: dungeon.mechanics?.revive_pool ?? (dungeon.single_player_balance ? 3 : 0),
    done: false
  };
  addLog(`进入 ${dungeon.name}`);
  spawnDungeonEnemy();
}

function spawnDungeonEnemy() {
  if (!state.dungeon) return;
  const dungeon = data.dungeonById[state.dungeon.id];
  const wave = dungeon.waves[state.dungeon.waveIndex];
  const monsterId = wave.monsterIds[Math.floor(Math.random() * wave.monsterIds.length)];
  startCombat(data.monsterById[monsterId]);
}

function advanceDungeon() {
  if (!state.dungeon) return;
  state.dungeon.remaining -= 1;
  if (state.dungeon.remaining > 0) {
    setTimeout(spawnDungeonEnemy, 450);
    return;
  }
  const dungeon = data.dungeonById[state.dungeon.id];
  state.dungeon.waveIndex += 1;
  if (state.dungeon.waveIndex >= dungeon.waves.length) {
    finishDungeon(dungeon);
    return;
  }
  state.dungeon.remaining = dungeon.waves[state.dungeon.waveIndex].count;
  addLog(`副本第 ${state.dungeon.waveIndex + 1} 波`);
  setTimeout(spawnDungeonEnemy, 700);
}

function finishDungeon(dungeon) {
  state.stats.dungeons += 1;
  state.dungeon.done = true;
  addExp(dungeon.rewards.exp);
  state.gold += dungeon.rewards.gold;
  dungeon.rewards.items.forEach((id) => addItem(id, 1));
  const quest = activeQuest();
  if (quest?.objective.type === "dungeon" && quest.objective.target === dungeon.id) {
    state.questProgress[quest.id] = 1;
  }
  if (state.activeActivity && data.activityById[state.activeActivity.id]?.dungeonId === dungeon.id) {
    completeActivity(state.activeActivity.id);
  }
  addLog(`通关 ${dungeon.name}`);
  state.dungeon = null;
  state.mapId = dungeon.entryMap;
  state.x = 240;
  state.y = 280;
}

function renderCreate() {
  const classCards = data.classes.map((classDef) => {
    const locked = VERTICAL_SLICE.enabled && classDef.id !== VERTICAL_SLICE.classId;
    const art = qAssetPath(`character_${classDef.id}`);
    return `
    <div class="class-card ${selectedClass === classDef.id ? "selected" : ""} ${locked ? "locked" : ""}" data-class="${classDef.id}">
      <div class="class-art class-${classDef.id}">${art ? `<img src="${art}" alt="${classDef.name}" />` : classDef.name.slice(0, 1)}</div>
      <div>
        <h3>${classDef.name}</h3>
        <div class="muted small">${locked ? "纵切版暂未开放" : `${classDef.role} · ${classDef.weapon}`}</div>
      </div>
      <div class="small">${locked ? "后续版本" : `攻速 ${classDef.attackInterval}s`}</div>
    </div>
  `;
  }).join("");
  app.innerHTML = `
    <main class="create slice-create">
      <section class="create-box">
        <div class="create-head">
          <span class="slice-badge">${VERTICAL_SLICE.title}</span>
          <h1>刺客 1-20 级极致纵切</h1>
          <p>${VERTICAL_SLICE.tagline}。这一版先把一条线打磨成“像手游”，再扩全职业与全地图。</p>
        </div>
        <div class="class-grid">${classCards}</div>
        <div class="create-form">
          <input id="heroName" maxlength="10" value="凌汐" aria-label="角色名" />
          <button class="primary" id="startGame">进入幻想</button>
        </div>
      </section>
    </main>
  `;
  document.querySelectorAll(".class-card").forEach((node) => {
    node.addEventListener("click", () => {
      if (VERTICAL_SLICE.enabled && node.dataset.class !== VERTICAL_SLICE.classId) return;
      selectedClass = node.dataset.class;
      renderCreate();
    });
  });
  document.querySelector("#startGame").addEventListener("click", () => {
    state = freshState(selectedClass, document.querySelector("#heroName").value.trim());
    initVitals();
    save();
    renderGameShell();
  });
}

function qAssetPath(id) {
  const asset = data.qAssetById?.[id];
  return asset?.q_asset && asset.q_asset !== "missing" ? asset.q_asset : "";
}

function renderGameShell() {
  app.innerHTML = `
    <main class="mmo-shell game-hud">
      <section class="stage mmo-stage">
        <canvas id="gameCanvas"></canvas>
        <div class="topbar mmo-identity"></div>
        <div class="mmo-clock">15:05</div>
        <div class="top-menu"></div>
        <div class="left-quest-tabs"><button class="active">任务</button><button>图鉴</button></div>
        <div class="float-log"></div>
        <div class="quest-track"></div>
        <div class="mini-map"></div>
        <div class="side-menu"></div>
        <div class="skill-wheel"></div>
        <div class="chat-bar"></div>
        <div class="bottom-dock"></div>
        <div class="quick"></div>
        <div class="rotate-lock"><strong>请横屏游玩</strong><span>添加到主屏幕后横屏打开，体验完整 PWA 游戏界面。</span></div>
        <section class="hud">
          <div class="drawer-head">
            <div class="tabs">
              <button data-tab="quest">任务</button>
              <button data-tab="role">角色</button>
              <button data-tab="bag">背包</button>
              <button data-tab="pet">宠物</button>
              <button data-tab="map">地图</button>
              <button data-tab="activity">日常</button>
              <button data-tab="endgame">后期</button>
            </div>
            <button class="drawer-close" data-action="closeDrawer" aria-label="关闭面板">×</button>
          </div>
          <div class="panel-body"></div>
        </section>
      </section>
    </main>
  `;
  canvas = document.querySelector("#gameCanvas");
  ctx = canvas.getContext("2d");
  canvas.addEventListener("pointerdown", onCanvasTap);
  document.querySelector(".tabs").addEventListener("click", (event) => {
    if (event.target.matches("button")) {
      selectTab(event.target.dataset.tab);
      renderGame();
    }
  });
  document.querySelector(".drawer-close").addEventListener("click", () => toggleDrawer(false));
  renderGame();
}

function renderGame() {
  if (!state) return;
  renderTopbar();
  renderQuick();
  renderPanel();
  renderOverlayHud();
  renderCanvas();
}

function renderOverlayHud() {
  const quest = activeQuest();
  const track = document.querySelector(".quest-track");
  if (track) {
    const progress = quest ? `${Math.min(questProgress(quest), quest.objective.count)}/${quest.objective.count}` : "";
    track.innerHTML = quest
      ? `<div class="quest-main"><strong>${quest.title}</strong><em>${progress}</em></div><span>${objectiveText(quest)}</span>`
      : `<div class="quest-main"><strong>主线阶段完成</strong><em>自由</em></div><span>刷副本、养宠、加工装备</span>`;
  }
  const mini = document.querySelector(".mini-map");
  if (mini) {
    mini.innerHTML = `<span>${currentMap().name}</span><i></i>`;
  }
  const wheel = document.querySelector(".skill-wheel");
  if (wheel) {
    const skills = activeSkills().slice(0, 4);
    const nowTime = now();
    wheel.innerHTML = `
      <button data-action="manualAttack" class="attack-btn ${state.autoCombat ? "active" : ""}" title="普攻/自动战斗"><i class="icon-frame">${iconSvg("weapon")}</i><span>普攻</span></button>
      ${skills.map((skill, index) => {
        const remain = Math.max(0, (state.cooldowns[skill.id] || 0) - nowTime);
        const disabled = remain > 0 || state.mp < skill.mp;
        const progress = remain > 0 ? clamp(remain / skill.cooldown, 0, 1) : 0;
        return `<button class="skill-${index + 1} ${disabled ? "cooling" : ""}" data-skill="${skill.id}" title="${skill.name}${remain > 0 ? ` 冷却 ${remain.toFixed(1)}s` : ""}" style="--cool:${progress}">
          <i class="skill-icon ${skillRuneClass(skill)}">${skillIconSvg(skill)}</i><span>${skill.name.slice(0, 2)}</span>${remain > 0 ? `<em>${Math.ceil(remain)}</em>` : ""}
        </button>`;
      }).join("")}
    `;
    wheel.onclick = (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.action === "manualAttack") {
        state.autoCombat = true;
        if (!state.combat) maybeStartEncounter();
        addLog("进入自动战斗");
      }
      if (button.dataset.skill) manualSkill(button.dataset.skill);
    };
  }
  const topMenu = document.querySelector(".top-menu");
  if (topMenu) {
    const items = [
      ["任务", "quest", "主线牵引"],
      ["背包", "bag", "装备道具"],
      ["地图", "map", currentMap().name],
      ["宠物", "pet", activePet() ? activePet().name : "未出战"],
      ["日常", "token", "试炼/猎杀"],
      ["后期", "tower", "高阶试炼"]
    ];
    topMenu.innerHTML = items.map(([item, iconType, hint], index) => `
      <button class="mmo-icon ${currentTab === tabFromMenu(item) ? "active" : ""}" data-tab="${tabFromMenu(item)}" title="${item} · ${hint}">
        <i class="icon-frame">${iconSvg(iconType)}</i><span>${item}</span>${index < 3 ? "<b></b>" : ""}
      </button>
    `).join("");
    topMenu.onclick = onHudMenuClick;
  }
  const sideMenu = document.querySelector(".side-menu");
  if (sideMenu) {
    sideMenu.innerHTML = [["背包", "bag"], ["地图", "map"], ["日常", "token"]].map(([item, iconType]) => `
      <button class="round-tool ${currentTab === tabFromMenu(item) ? "active" : ""}" data-tab="${tabFromMenu(item)}"><i class="icon-frame">${iconSvg(iconType)}</i><span>${item}</span></button>
    `).join("");
    sideMenu.onclick = onHudMenuClick;
  }
  const chat = document.querySelector(".chat-bar");
  if (chat) {
    chat.innerHTML = `
      <button>战</button>
      <span>${combatStatusText(quest)}</span>
      <button data-action="save">存</button>
    `;
    chat.onclick = (event) => {
      if (event.target.dataset.action === "save") {
        save();
        addLog("已保存");
      }
    };
  }
  const dock = document.querySelector(".bottom-dock");
  if (dock) {
    dock.innerHTML = ["补给", "修理", "回城"].map((item) => `<button data-action="${dockAction(item)}">${item}</button>`).join("");
    dock.onclick = (event) => {
      const action = event.target.dataset.action;
      if (action === "repair") repairAll();
      if (action === "home") setTarget("longcheng", 360, 320, "回城", { manual: true });
      if (action === "supply") {
        state.autoSupply = true;
        addLog("自动补给已开启");
      }
    };
  }
}

function combatStatusText(quest) {
  if (state.combat) return `战斗中：${state.combat.enemy.name} · ${Math.max(0, Math.ceil(state.combat.enemy.hp))}/${state.combat.enemy.maxHp}`;
  if (state.dungeon) {
    const dungeon = data.dungeonById[state.dungeon.id];
    const timer = state.dungeon.timeLeft ? ` · ${Math.ceil(state.dungeon.timeLeft)}秒` : "";
    return `试炼：${dungeon?.name || state.dungeon.id} · ${state.dungeon.waveIndex + 1}/${dungeon?.waves?.length || 1} · 复活 ${state.dungeon.revivesLeft ?? 0}${timer}`;
  }
  if (state.target) return `寻路中：${state.target.label}`;
  return quest ? `任务：${objectiveText(quest)}` : "继续刷怪、抓宠、打副本";
}

function dockAction(label) {
  if (label === "修理") return "repair";
  if (label === "回城") return "home";
  return "supply";
}

function tabFromMenu(label) {
  if (label === "背包") return "bag";
  if (label === "宠物") return "pet";
  if (label === "技能") return "role";
  if (label === "日常") return "activity";
  if (label === "后期") return "endgame";
  if (label === "地图") return "map";
  return "quest";
}

function onHudMenuClick(event) {
  const tab = event.target.closest("button")?.dataset.tab;
  if (!tab) return;
  selectTab(tab);
  document.querySelector(".hud")?.classList.toggle("open", true);
  renderGame();
}

function toggleDrawer(open) {
  document.querySelector(".hud")?.classList.toggle("open", open);
}

function renderTopbar() {
  const classDef = data.classById[state.classId];
  const stats = getStats();
  document.querySelector(".topbar").innerHTML = `
    <div class="identity">
      <div class="portrait">${qAssetPath(`character_${state.classId}`) ? `<img src="${qAssetPath(`character_${state.classId}`)}" alt="${classDef.name}" />` : `<span>${classDef.name[0]}</span>`}</div>
      <div class="bars">
        <div class="name-line"><strong>${state.name}</strong><span class="pill">Lv.${state.level} ${classDef.name}</span><span class="pill">${currentMap().name}</span></div>
        <div class="bar hp"><i style="width:${pct(state.hp, stats.maxHp)}"></i></div>
        <div class="bar mp"><i style="width:${pct(state.mp, stats.maxMp)}"></i></div>
        <div class="bar xp"><i style="width:${pct(state.exp, expToNext())}"></i></div>
        <div class="status-icons">${statusIconsHtml()}</div>
        <div class="meta">HP ${Math.floor(state.hp)}/${stats.maxHp} · MP ${Math.floor(state.mp)}/${stats.maxMp} · 金币 ${state.gold}</div>
      </div>
    </div>
  `;
  const topActions = document.querySelector(".top-actions");
  if (!topActions) return;
  topActions.onclick = (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    if (action === "save") {
      save();
      addLog("已保存");
    }
    if (action === "repair") repairAll();
    if (action === "home") setTarget("longcheng", 360, 320, "回城");
    if (action === "reset" && confirm("清空当前本地存档并重新创建角色？")) {
      localStorage.removeItem(SAVE_KEY);
      state = null;
      renderCreate();
    }
  };
}

function statusIconsHtml() {
  const buffs = (state.buffs || []).slice(0, 4).map((buff) => `<i class="status-icon buff" title="${buff.name}">${skillIconSvgByType("light")}<em>${Math.ceil(buff.until - now())}</em></i>`);
  const debuffs = (state.combat?.enemy?.debuffs || []).slice(0, 3).map((debuff) => `<i class="status-icon debuff" title="${debuff.name}">${skillIconSvgByType("poison")}<em>${Math.ceil(debuff.until - now())}</em></i>`);
  return [...buffs, ...debuffs].join("");
}

function renderQuick() {
  const buttons = [
    ["autoQuest", "任务", "quest"],
    ["autoPath", "寻路", "path"],
    ["autoCombat", "战斗", "weapon"],
    ["autoSupply", "补给", "potion"]
  ];
  document.querySelector(".quick").innerHTML = buttons.map(([key, label, iconType]) => `
    <button class="${state[key] ? "active" : ""}" data-toggle="${key}" title="${label}${state[key] ? "已开启" : "已关闭"}"><i class="icon-frame">${iconSvg(iconType)}</i><span>${label}</span></button>
  `).join("");
  document.querySelector(".quick").onclick = (event) => {
    const key = event.target.closest("button")?.dataset.toggle;
    if (!key) return;
    state[key] = !state[key];
    renderGame();
  };
}

function renderPanel() {
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === currentTab);
  });
  const body = document.querySelector(".panel-body");
  if (currentTab === "quest") body.innerHTML = questPanel();
  if (currentTab === "role") body.innerHTML = rolePanel();
  if (currentTab === "bag") body.innerHTML = bagPanel();
  if (currentTab === "pet") body.innerHTML = petPanel();
  if (currentTab === "map") body.innerHTML = mapPanel();
  if (currentTab === "activity") body.innerHTML = activityPanel();
  if (currentTab === "endgame") body.innerHTML = endgamePanel();
  body.onclick = onPanelClick;
  document.querySelector(".hud").ondblclick = () => toggleDrawer(false);
}

function panelFrame(title, subtitle, iconType, content, actions = "") {
  return `
    <div class="rpg-panel">
      <div class="rpg-panel-title">
        <i class="icon-frame">${iconSvg(iconType)}</i>
        <div><h2>${title}</h2><span>${subtitle}</span></div>
        ${actions ? `<div class="rpg-panel-actions">${actions}</div>` : ""}
      </div>
      ${content}
    </div>
  `;
}

function questPanel() {
  const quest = activeQuest();
  const list = data.quests.filter((item) => canAcceptQuest(item) && item.id !== state.activeQuestId).slice(0, 6).map((item) => {
    const progress = questProgress(item);
    const active = item.id === state.activeQuestId;
    return `
      <div class="card">
        <div class="row"><h3>${item.title}</h3><span class="pill">${item.chain}</span></div>
        <div class="muted small">${objectiveText(item)} · ${progress}/${item.objective.count}</div>
        <div class="row"><span class="small">奖励 ${item.rewards.exp || 0}经验 ${item.rewards.gold || 0}金币</span><button data-quest="${item.id}" class="${active ? "active" : ""}">${active ? "追踪中" : "追踪"}</button></div>
      </div>
    `;
  }).join("");
  return panelFrame(
    "任务指引",
    quest ? `${quest.chain} · ${Math.min(questProgress(quest), quest.objective.count)}/${quest.objective.count}` : "自由刷怪与养成",
    "quest",
    `
      <div class="quest-focus">
        <div><strong>${quest ? quest.title : "主线阶段完成"}</strong><span>${quest ? objectiveText(quest) : "可以继续刷副本、养宠、加工装备。"}</span></div>
        <button class="primary" data-action="guide">传送指引</button>
      </div>
      <div class="list compact-list">${list || '<div class="empty">暂无可接任务</div>'}</div>
    `
  );
}

function objectiveText(quest) {
  const obj = quest.objective;
  if (obj.type === "talk") return `对话：${data.npcById[obj.target]?.name}`;
  if (obj.type === "kill") return `击败：${data.monsterById[obj.target]?.name} x${obj.count}`;
  if (obj.type === "kill_any") return `击败任意野外怪 x${obj.count}`;
  if (obj.type === "collect") return `收集：${itemName(obj.target)} x${obj.count}`;
  if (obj.type === "catch_pet") return `捕捉：${data.petById[obj.target]?.name}`;
  if (obj.type === "dungeon") return `通关：${data.dungeonById[obj.target]?.name}`;
  if (obj.type === "learn_skill") return `学习/确认技能：${skillName(obj.target)}`;
  if (obj.type === "allocate_attr") return `分配属性点 x${obj.count}`;
  if (obj.type === "equip_item") return `装备：${itemName(obj.target)}`;
  if (obj.type === "enhance_item") return `加工${slotName(obj.slot || "weapon")} +${obj.plus || 1}`;
  if (obj.type === "socket_item") return `打孔镶嵌：${slotName(obj.slot || "weapon")}`;
  if (obj.type === "train_pet") return `培育出战宠物 x${obj.training || obj.count}`;
  if (obj.type === "use_pet_skill_pill") return `使用宠物技能丸至 Lv.${obj.skillLevel || 2}`;
  if (obj.type === "activate_pet_circle") return "开启宠物法阵";
  if (obj.type === "clear_activity") return `完成日常：${data.activityById[obj.target]?.name || obj.target}`;
  return obj.type;
}

function rolePanel() {
  const stats = getStats();
  const skills = (data.skillsByClass[state.classId] || []).map((skill) => {
    const learned = state.level >= skill.levelReq;
    const remain = Math.max(0, (state.cooldowns[skill.id] || 0) - now());
    return `<div class="skill-node ${learned ? "learned" : "locked"}">
      <i class="skill-icon ${skillRuneClass(skill)}">${skillIconSvg(skill)}</i>
      <div><strong>${skill.name}</strong><span>Lv.${skill.levelReq}+ · ${skill.type === "passive" ? "被动" : `${skill.mp}MP / ${skill.cooldown}s`}</span></div>
      <em>${learned ? (remain > 0 ? `${Math.ceil(remain)}s` : "已学") : "未解锁"}</em>
    </div>`;
  }).join("");
  const classDef = data.classById[state.classId];
  const firstJob = data.advancement.firstJob;
  const ascension = data.advancement.ascension;
  return panelFrame(
    "角色与技能",
    `${classDef.name} · ${classDef.role} · ${classDef.weapon}`,
    "role",
    `
      <div class="role-layout">
        <div class="avatar-showcase"><canvas aria-hidden="true"></canvas><strong>${state.name}</strong><span>${state.progression.ascension ? ascension.titleSuffix : state.progression.firstJob ? firstJob.titleSuffix : "初入幻想"}</span></div>
        <div class="stat-board">
          ${["str", "int", "vit", "agi", "spi"].map((key) => `
            <button class="attr-row" data-attr="${key}" ${state.freeAttr <= 0 ? "disabled" : ""}><span>${attrName(key)}</span><strong>${state.attr[key]}</strong><em>+</em></button>
          `).join("")}
          <div class="muted small">可分配属性点：${state.freeAttr}</div>
        </div>
        <div class="battle-board">
          ${[
            ["攻击", stats.attack],
            ["法攻", stats.magicAttack],
            ["防御", stats.defense],
            ["暴击", `${stats.crit}%`],
            ["攻速", `${stats.attackInterval.toFixed(2)}s`]
          ].map(([name, value]) => `<div><span>${name}</span><strong>${value}</strong></div>`).join("")}
        </div>
      </div>
      <div class="skill-tree">${skills || '<div class="empty">升级后自动学习职业核心技能</div>'}</div>
      <div class="advance-strip">
        <span>转职 Lv.${firstJob.levelReq}+ / 飞升 Lv.${ascension.levelReq}+</span>
        <button data-action="advanceFirst" ${state.progression.firstJob ? "disabled" : ""}>${state.progression.firstJob ? "已进阶" : "职业进阶"}</button>
        <button data-action="advanceAscend" ${!state.progression.firstJob || state.progression.ascension ? "disabled" : ""}>${state.progression.ascension ? "已飞升" : "飞升"}</button>
      </div>
    `
  );
}

function attrName(key) {
  return { str: "力量", int: "智慧", vit: "体质", agi: "敏捷", spi: "精神" }[key];
}

function bagPanel() {
  const equipped = Object.entries(state.equipment).map(([slot, equip]) => {
    if (!equip) return `<div class="equip-slot"><i class="icon-frame">${iconSvg("bag")}</i><div><strong>${slotName(slot)}</strong><span>未装备</span></div></div>`;
    const base = data.equipmentById[equip.id];
    return `<div class="equip-slot quality-${base.quality}"><i class="icon-frame">${iconSvg(slotIcon(slot))}</i><div><strong>${base.name}${equip.plus ? ` +${equip.plus}` : ""}</strong><span>${slotName(slot)} · 耐久 ${Math.floor(equip.durability)}/${base.durability} · 孔 ${equip.sockets || 0}</span></div></div>`;
  }).join("");
  const items = state.inventory.map((item, index) => {
    if (item.equip) {
      const base = data.equipmentById[item.equip.id];
      return `<button class="bag-cell quality-${base.quality}" data-equip-index="${index}"><i class="icon-frame">${iconSvg(slotIcon(base.slot))}</i><strong>${base.name}</strong><span>Lv.${base.levelReq}</span></button>`;
    }
    return `<div class="bag-cell"><i class="icon-frame">${iconSvg(item.id.includes("hp") || item.id.includes("mp") ? "potion" : "item")}</i><strong>${itemName(item.id)}</strong><span>x${item.qty}</span></div>`;
  }).join("");
  return panelFrame(
    "装备背包",
    `金币 ${state.gold} · 装备耐久、加工、打孔、附魂`,
    "bag",
    `
      <div class="equipment-board">${equipped}</div>
      <div class="forge-actions">
        <button data-action="enhanceWeapon">加工武器</button>
        <button data-action="socketWeapon">打孔镶嵌</button>
        <button data-action="soulWeapon">附魂</button>
      </div>
      <div class="bag-grid">${items || '<div class="empty">背包为空</div>'}</div>
    `
  );
}

function slotName(slot) {
  return { weapon: "武器", armor: "防具", accessory: "饰品" }[slot] || slot;
}

function slotIcon(slot) {
  return { weapon: "weapon", armor: "armor", accessory: "ring" }[slot] || "item";
}

function skillRuneClass(skill) {
  if (/治|祝|光/.test(skill.name)) return "rune-heal";
  if (/火|焰|炎/.test(skill.name)) return "rune-fire";
  if (/冰|霜|寒/.test(skill.name)) return "rune-ice";
  if (/毒|淬/.test(skill.name)) return "rune-poison";
  if (/枪|刺|穿/.test(skill.name)) return "rune-spear";
  if (/剑|斩|击/.test(skill.name)) return "rune-slash";
  if (skill.type === "passive") return "rune-passive";
  return "rune-light";
}

function iconSvg(type) {
  const common = 'viewBox="0 0 64 64" aria-hidden="true" focusable="false"';
  const svgs = {
    quest: `<svg ${common}><path d="M18 14h25c5 0 9 4 9 9v24c0 3-2 5-5 5H18c-3 0-6-3-6-6V20c0-3 3-6 6-6Z" fill="#f0d08a"/><path d="M42 14c-4 2-5 6-2 9H18c-5 0-7-4-3-7 1-1 2-2 3-2h24Z" fill="#fff0b8"/><path d="M23 29h20M23 37h16M23 45h12" stroke="#6d4225" stroke-width="4" stroke-linecap="round"/></svg>`,
    bag: `<svg ${common}><path d="M22 24v-5c0-7 5-11 10-11s10 4 10 11v5" fill="none" stroke="#ffe6a4" stroke-width="5" stroke-linecap="round"/><path d="M15 24h34l-3 30H18L15 24Z" fill="#a96839"/><path d="M20 29h24l-2 18H22l-2-18Z" fill="#e0a95a"/><circle cx="25" cy="25" r="3" fill="#fff0ba"/><circle cx="39" cy="25" r="3" fill="#fff0ba"/></svg>`,
    map: `<svg ${common}><path d="M12 17l13-5 15 5 12-5v35l-13 5-15-5-12 5V17Z" fill="#d8c17a"/><path d="M25 12v35M40 17v35" stroke="#6d6f44" stroke-width="3"/><path d="M16 33c8-8 14 5 22-5 5-6 9-4 13-2" fill="none" stroke="#557f56" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="26" r="5" fill="#df5042"/></svg>`,
    pet: `<svg ${common}><circle cx="32" cy="36" r="11" fill="#fff1d0"/><circle cx="18" cy="27" r="6" fill="#fff1d0"/><circle cx="28" cy="19" r="6" fill="#fff1d0"/><circle cx="40" cy="19" r="6" fill="#fff1d0"/><circle cx="48" cy="28" r="6" fill="#fff1d0"/><path d="M25 38c4 3 10 3 14 0" stroke="#7a4a2d" stroke-width="3" stroke-linecap="round"/></svg>`,
    token: `<svg ${common}><path d="M32 8c12 5 18 12 18 24 0 15-9 22-18 24-9-2-18-9-18-24C14 20 20 13 32 8Z" fill="#c87538"/><path d="M32 14c8 4 12 9 12 18 0 10-5 15-12 18-7-3-12-8-12-18 0-9 4-14 12-18Z" fill="#ffd577"/><path d="M24 32h16M32 24v16" stroke="#71401f" stroke-width="5" stroke-linecap="round"/></svg>`,
    tower: `<svg ${common}><path d="M18 54h28l-4-30H22l-4 30Z" fill="#9f7141"/><path d="M16 24h32L32 9 16 24Z" fill="#f0ce78"/><path d="M20 35h24M22 44h20" stroke="#5d3a22" stroke-width="4"/><rect x="28" y="43" width="8" height="11" rx="2" fill="#4e3524"/></svg>`,
    path: `<svg ${common}><path d="M14 47c13 0 12-20 25-20h7" fill="none" stroke="#d9ffb4" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 8"/><path d="M42 16l11 11-11 11" fill="none" stroke="#fff2a9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    potion: `<svg ${common}><path d="M26 10h12v12l8 10v15c0 5-4 9-9 9H27c-5 0-9-4-9-9V32l8-10V10Z" fill="#80dfff"/><path d="M21 36h22v12c0 3-3 5-6 5H27c-3 0-6-2-6-5V36Z" fill="#5bee8c"/><path d="M25 10h14" stroke="#ffe5a0" stroke-width="5" stroke-linecap="round"/></svg>`,
    weapon: `<svg ${common}><path d="M47 9L21 39l-6 10 10-6L55 17l-8-8Z" fill="#e8f7ff"/><path d="M20 38l7 7M13 51l9-9" stroke="#7b4a2d" stroke-width="6" stroke-linecap="round"/></svg>`,
    armor: `<svg ${common}><path d="M32 8l20 8-4 26c-2 10-10 16-16 18-6-2-14-8-16-18l-4-26 20-8Z" fill="#98a8b8"/><path d="M32 15v36M20 21h24" stroke="#fff0ba" stroke-width="4" stroke-linecap="round"/></svg>`,
    ring: `<svg ${common}><circle cx="32" cy="36" r="15" fill="none" stroke="#f6d36d" stroke-width="8"/><path d="M24 20l8-10 8 10-8 8-8-8Z" fill="#8be8ff"/></svg>`,
    item: `<svg ${common}><path d="M18 18h28v34H18z" fill="#c89154"/><path d="M18 18l6-8h16l6 8" fill="#f0d28c"/><path d="M24 30h16M24 39h12" stroke="#704323" stroke-width="4" stroke-linecap="round"/></svg>`,
    role: `<svg ${common}><circle cx="32" cy="20" r="10" fill="#ffe0b9"/><path d="M15 55c2-14 11-22 17-22s15 8 17 22H15Z" fill="#5aa27b"/><path d="M22 55c2-8 6-12 10-12s8 4 10 12" fill="#2f5d50"/></svg>`
  };
  return svgs[type] || svgs.item;
}

function skillIconSvg(skill) {
  return skillIconSvgByType(skillEffectType(skill));
}

function skillIconSvgByType(type) {
  const common = 'viewBox="0 0 64 64" aria-hidden="true" focusable="false"';
  const svgs = {
    flame: `<svg ${common}><path d="M34 6c8 12-4 14 8 25 5 5 6 14-1 21-8 8-23 6-27-5-4-10 3-16 8-22 2 8 8 7 9 0 1-6-2-10 3-19Z" fill="#ff7438"/><path d="M33 33c5 7 0 16-7 16-4 0-8-3-8-8 0-5 5-8 7-13 1 5 5 6 8 5Z" fill="#ffe36d"/></svg>`,
    ice: `<svg ${common}><path d="M32 8v48M12 20l40 24M52 20L12 44" stroke="#c9f7ff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="32" r="9" fill="#72d8ff"/></svg>`,
    poison: `<svg ${common}><circle cx="24" cy="38" r="12" fill="#8dff70"/><circle cx="40" cy="30" r="10" fill="#54bf54"/><circle cx="30" cy="20" r="7" fill="#d8ff8a"/></svg>`,
    light: `<svg ${common}><circle cx="32" cy="32" r="10" fill="#fff4a2"/><path d="M32 7v12M32 45v12M7 32h12M45 32h12M15 15l9 9M49 15l-9 9M15 49l9-9M49 49l-9-9" stroke="#fff7c4" stroke-width="5" stroke-linecap="round"/></svg>`,
    slash: `<svg ${common}><path d="M50 10C40 31 30 44 12 54c17-1 36-13 45-36l-7-8Z" fill="#f4fbff"/><path d="M17 45c12-3 23-12 32-28" stroke="#87d7ff" stroke-width="5" stroke-linecap="round"/></svg>`,
    spear: `<svg ${common}><path d="M54 9L42 16l6 6 6-13Z" fill="#fff4b3"/><path d="M12 52l34-34" stroke="#f3e6c2" stroke-width="7" stroke-linecap="round"/><path d="M17 47l-5 5" stroke="#8c4d2e" stroke-width="9" stroke-linecap="round"/></svg>`,
    heal: `<svg ${common}><path d="M32 11c10 10 18 16 18 27 0 9-7 15-18 15s-18-6-18-15c0-11 8-17 18-27Z" fill="#7df0a0"/><path d="M32 25v18M23 34h18" stroke="#fffbd0" stroke-width="6" stroke-linecap="round"/></svg>`,
    passive: `<svg ${common}><circle cx="32" cy="32" r="22" fill="#bda4ff"/><path d="M22 34l7 7 15-19" fill="none" stroke="#fff5c8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    armor: iconSvg("armor")
  };
  return svgs[type] || svgs.light;
}

function petPanel() {
  const catalog = data.petRuntimeCatalog || data.fullPetCatalog;
  const roleCounts = (catalog.pets || []).reduce((acc, pet) => {
    const role = pet.catalog_role || pet.runtime_role || "unknown";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  const rareSamples = (catalog.pets || [])
    .filter((pet) => pet.unlock_source === "endgame_activity_or_event")
    .slice(0, 4)
    .map((pet) => pet.project_name || pet.original_name)
    .join("、");
  const pets = state.pets.map((pet) => {
    const base = data.petById[pet.id];
    if (!base) return "";
    const stats = petBattleStats(pet);
    return `
      <button class="pet-list-row ${state.activePetId === pet.uid ? "active" : ""}" data-pet="${pet.uid}">
        <i class="pet-mini"></i><strong>${pet.name}</strong><span>Lv.${pet.level} · ${base.growthType}</span><em>${state.activePetId === pet.uid ? "出战" : "待命"}</em>
      </button>
    `;
  }).join("");
  const active = activePet();
  const base = active ? data.petById[active.id] : null;
  const stats = active ? petBattleStats(active) : null;
  const petAttrs = active ? petRuntimeAttrs(active, stats) : null;
  return panelFrame(
    "宝贝宠物",
    `图鉴 ${catalog.count || 0} 只 · 坐骑/珍稀 ${roleCounts.mount_or_rare || 0} · 稀有战斗 ${roleCounts.rare_combat || 0}`,
    "pet",
    `
      <div class="pet-system-panel">
        <div class="pet-portrait">
          ${active ? `<div class="pet-model"><canvas aria-hidden="true"></canvas></div><strong>${active.name}</strong><span>等级 Lv.${active.level} · ${base.growthType} · ${base.skill}</span>` : "<strong>暂无宠物</strong><span>10级后跟随任务捕捉</span>"}
        </div>
        <div class="pet-vitals">
          ${active ? [
            ["生命", stats.maxHp],
            ["法力", stats.maxMp],
            ["攻击", stats.attack],
            ["防御", stats.defense],
            ["命中", stats.hit],
            ["魔攻", stats.magicAttack],
            ["魔防", stats.magicDefense],
            ["信赖", active.trust],
            ["饥渴", active.hunger ?? 0],
            ["技能", `Lv.${active.skillLevel || 1}`]
          ].map(([name, value]) => `<div><span>${name}</span><strong>${value}</strong></div>`).join("") : '<div class="empty">暂无出战宠物</div>'}
        </div>
      </div>
      <div class="panel-subtitle">基础属性加点</div>
      <div class="pet-attr-grid">
        ${active ? Object.entries(petAttrs).map(([key, value]) => `<button class="pet-attr-row" disabled><span>${petAttrName(key)}</span><strong>${value}</strong><em>+</em></button>`).join("") : ""}
      </div>
      <div class="forge-actions">
        <button data-action="feedPet">喂养</button>
        <button data-action="trainPet">培育</button>
        <button data-action="skillPet">技能丸</button>
        <button data-action="circlePet">法阵</button>
      </div>
      <div class="pet-skill-grid">
        ${[
          ["战斗技能", active ? base.skill : "空", "slash"],
          ["生活技能", "采集/拾取", "heal"],
          ["宠物法阵", active?.circle ? "已激活" : "未激活", "light"],
          ["宠物装备", "待装备", "armor"],
          ["技能丸", active ? `Lv.${active.skillLevel || 1}` : "空", "poison"],
          ["忠诚被动", active ? `信赖 ${active.trust}` : "空", "passive"]
        ].map(([name, desc, icon]) => `<div><i class="skill-icon rune-${icon}">${skillIconSvgByType(icon)}</i><strong>${name}</strong><span>${desc}</span></div>`).join("")}
      </div>
      <div class="codex-note"><strong>全宠物图鉴</strong><span>目录身份表已本地化；运行时只开放已补齐捕捉来源、资质和技能的宠物。</span></div>
      <div class="panel-subtitle">我的宠物列表</div>
      <div class="pet-list">${pets || '<div class="empty">暂无宠物</div>'}</div>
      <div class="muted small">后期样例：${rareSamples || "待补"}；未补齐捕捉点、食性、资质和技能绑定前只进入图鉴，不进入运行时捕捉。</div>
    `
  );
}

function petRuntimeAttrs(pet, stats) {
  const base = data.petById[pet.id];
  const typeBoost = { swift: ["agi", "dex"], sturdy: ["vit", "str"], spirit: ["int", "spi"] }[base.growthType] || ["str", "vit"];
  const seed = Math.max(1, pet.level + Math.floor(pet.trust / 10) + (pet.training || 0) * 2);
  return {
    str: 8 + seed + (typeBoost.includes("str") ? 5 : 0),
    vit: 10 + seed + (typeBoost.includes("vit") ? 6 : 0),
    agi: 7 + seed + (typeBoost.includes("agi") ? 6 : 0),
    int: 5 + Math.floor(seed * 0.72) + (typeBoost.includes("int") ? 6 : 0),
    dex: 6 + Math.floor(seed * 0.8) + (typeBoost.includes("dex") ? 5 : 0),
    spi: 6 + Math.floor(seed * 0.75) + (typeBoost.includes("spi") ? 5 : 0)
  };
}

function petAttrName(key) {
  return { str: "力量", vit: "体质", agi: "敏捷", int: "智慧", dex: "灵巧", spi: "精神" }[key] || key;
}

function mapPanel() {
  const maps = data.maps.filter((map) => map.type !== "dungeon" || state.level >= map.levelRange[0]).map((map) => `
    <div class="map-card ${map.id === state.mapId ? "active" : ""}">
      <i class="map-thumb ${data.mapSceneById[map.id]?.theme || map.type}"></i>
      <div><strong>${map.name}</strong><span>${map.type} · Lv.${map.levelRange[0]}-${map.levelRange[1]}</span></div>
      <button data-map="${map.id}">${map.id === state.mapId ? "当前" : "传送"}</button>
    </div>
  `).join("");
  const dungeons = data.dungeons.map((dungeon) => `
    <div class="map-card dungeon">
      <i class="map-thumb dungeon"></i>
      <div><strong>${dungeon.name}</strong><span>Lv.${dungeon.levelReq}+ · ${dungeon.waves.length} 波</span></div>
      <button data-dungeon="${dungeon.id}" ${state.level < dungeon.levelReq ? "disabled" : ""}>进入</button>
    </div>
  `).join("");
  return panelFrame(
    "地图传送",
    `${currentMap().name} · 任务和地图都支持跨图传送`,
    "map",
    `<div class="map-list">${maps}${dungeons}</div>`
  );
}

function activityPanel() {
  const cards = data.activities.map((activity) => {
    resetActivityDay();
    const runs = state.activityRuns[activity.id] || 0;
    const active = state.activeActivity?.id === activity.id;
    const locked = state.level < activity.levelReq || runs >= activity.dailyLimit || Boolean(state.activeActivity);
    const target = activity.target ? ` · 进度 ${active ? state.activeActivity.progress : 0}/${activity.target.count}` : "";
    return `
      <div class="card">
        <div class="row"><h3>${activity.name}</h3><button data-activity="${activity.id}" ${locked ? "disabled" : ""}>${active ? "进行中" : "开始"}</button></div>
        <div class="muted small">Lv.${activity.levelReq}+ · 今日 ${runs}/${activity.dailyLimit}${target} · 完成后奖励 ${activity.rewards.exp}经验 ${activity.rewards.gold}金币</div>
      </div>
    `;
  }).join("");
  return `<div class="list">${cards}</div>`;
}

function endgamePanel() {
  const runtimeMaterialCount = data.endgameMaterials.runtime_materials?.length || data.endgameMaterials.materials.length;
  const petCatalogCount = data.petRuntimeCatalog?.count || data.fullPetCatalog.count;
  const bossCount = data.endgameBosses?.boss_count || 0;
  const runtimeBySource = Object.fromEntries((data.runtimeEndgameDungeons?.dungeons || []).map((dungeon) => [dungeon.source_dungeon_id, dungeon]));
  const priorityCards = [
    ["通天魔劫塔", "每日挑战", "30层塔、BOSS限时、千幻魂石与变装奖励已结构化"],
    ["龙翼秘宝", "毕业装备", "穿戴、合成、加工10级、强化概率和职业孔属性已落表"],
    ["典籍卡", "收集成长", "54张卡、5品阶、5星级、升阶/升星材料已落表"],
    ["翅膀雕花", "外观战力", "5/10/15级翎羽兑换、套装属性和适配翅膀已落表"]
  ].map(([name, tag, text]) => `
    <div class="card endgame-goal">
      <div class="row"><h3>${name}</h3><span class="pill">${tag}</span></div>
      <div class="muted small">${text}</div>
      <button data-tab="${name === "通天魔劫塔" ? "map" : "bag"}">查看入口</button>
    </div>
  `).join("");
  const details = (data.p3SystemDetails.systems || []).slice(0, 6).map((system) => `
    <div class="card">
      <div class="row"><h3>${system.project_name || system.original_name}</h3><span class="pill">${system.category}</span></div>
      <div class="muted small">已结构化：${Object.keys(system).filter((key) => !["id", "original_name", "project_name", "category", "source_file", "source_confidence", "gaps"].includes(key)).slice(0, 4).join("、")}</div>
      <div class="small">缺口：${(system.gaps || []).slice(0, 2).join("、") || "暂无"}</div>
    </div>
  `).join("");
  const systems = data.lateGrowth.systems.map((system) => `
    <div class="card">
      <div class="row"><h3>${system.name}</h3><span class="pill">${system.source_confidence}</span></div>
      <div class="muted small">资料表：${system.table.replace("data/design/", "")}</div>
      <div class="small">缺口：${system.gaps.slice(0, 3).join("、") || "暂无"}</div>
    </div>
  `).join("");
  const dungeonBossCount = (id) => data.endgameBosses?.dungeons?.find((item) => item.id === id)?.boss_ids?.length || 0;
  const dungeons = (data.endgameDungeons.records || []).map((dungeon) => `
    <div class="card">
      <div class="row"><h3>${dungeon.project_name}</h3><span class="pill">${dungeon.source_confidence}</span></div>
      <div class="muted small">${dungeon.level_requirement || "等级待补"} · BOSS/对象 ${dungeonBossCount(dungeon.id)} · 单机奖励 ${dungeon.single_player_runtime?.display_rewards?.length || 0} · ${dungeon.single_player_runtime?.frequency_display || "次数待补"}</div>
      <div class="small">单机试炼：${runtimeBySource[dungeon.id]?.waves.length || 0} 波 · 复活 ${runtimeBySource[dungeon.id]?.mechanics?.revive_pool ?? 0} · ${runtimeBySource[dungeon.id]?.mechanics?.timer_seconds ? `${runtimeBySource[dungeon.id].mechanics.timer_seconds}秒限时` : "不限时"} · 本地平衡，非官方完整数值</div>
      <button data-runtime-dungeon="${runtimeBySource[dungeon.id]?.id || ""}" ${!runtimeBySource[dungeon.id] || state.level < runtimeBySource[dungeon.id].levelReq ? "disabled" : ""}>进入单机试炼</button>
    </div>
  `).join("");
  return `
    <div class="list">
      <div class="card endgame-summary">
        <div class="row"><h3>P3 后期目标</h3><span class="pill">80-110</span></div>
        <div class="muted small">路线：高阶副本刷材料 -> 装备/龙翼/典籍/翅膀成长 -> 110级毕业循环。已落底座：全宠物图鉴 ${petCatalogCount}、宠物技能 ${data.petSkills.length}、高阶BOSS/对象 ${bossCount}、单机试炼 ${data.runtimeEndgameDungeons?.dungeon_count || 0}、P3规则 ${data.p3SystemDetails.systems.length}、单机材料 ${runtimeMaterialCount}。</div>
        <div class="small">高阶入口为“进入单机试炼”，当前采用本地平衡，非官方完整数值；缺口会继续保留在资料明细里。</div>
      </div>
      ${priorityCards}
      <details class="audit-details">
        <summary>资料缺口与落表明细</summary>
        <div class="list">${details}${systems}${dungeons}</div>
      </details>
    </div>
  `;
}

function onPanelClick(event) {
  const target = event.target;
  if (target.dataset.action === "guide") guideQuest();
  if (target.dataset.quest) {
    state.activeQuestId = target.dataset.quest;
    guideQuest(data.questById[state.activeQuestId]);
  }
  if (target.dataset.attr && state.freeAttr > 0) {
    state.attr[target.dataset.attr] += 1;
    state.freeAttr -= 1;
    initVitals();
  }
  if (target.dataset.equipIndex) equipFromBag(Number(target.dataset.equipIndex));
  if (target.dataset.pet) state.activePetId = target.dataset.pet;
  if (target.dataset.action === "feedPet") feedActivePet();
  if (target.dataset.action === "trainPet") trainActivePet();
  if (target.dataset.action === "skillPet") skillActivePet();
  if (target.dataset.action === "circlePet") activatePetCircle();
  if (target.dataset.action === "enhanceWeapon") enhanceEquipped("weapon");
  if (target.dataset.action === "socketWeapon") socketEquipped("weapon");
  if (target.dataset.action === "soulWeapon") soulEquipped("weapon");
  if (target.dataset.action === "advanceFirst") advanceCharacter("firstJob");
  if (target.dataset.action === "advanceAscend") advanceCharacter("ascension");
  if (target.dataset.map) setTarget(target.dataset.map, 180, 180, "传送", { manual: true });
  if (target.dataset.dungeon) enterDungeon(target.dataset.dungeon);
  if (target.dataset.runtimeDungeon) enterDungeon(target.dataset.runtimeDungeon);
  if (target.dataset.activity) runActivity(target.dataset.activity);
  if (target.dataset.tab) selectTab(target.dataset.tab);
  renderGame();
}

function equipFromBag(index) {
  const item = state.inventory[index];
  if (!item?.equip) return;
  const base = data.equipmentById[item.equip.id];
  if (state.level < base.levelReq) {
    addLog("等级不足");
    return;
  }
  if (!base.classIds.includes("all") && !base.classIds.includes(state.classId)) {
    addLog("职业不符");
    return;
  }
  const old = state.equipment[base.slot];
  state.equipment[base.slot] = item.equip;
  state.inventory.splice(index, 1);
  if (old) state.inventory.push({ equip: old, qty: 1 });
  initVitals();
  addLog(`装备 ${base.name}`);
}

function repairAll() {
  let cost = 0;
  Object.values(state.equipment).forEach((equip) => {
    if (!equip) return;
    const base = data.equipmentById[equip.id];
    cost += Math.ceil((base.durability - equip.durability) * 0.8);
  });
  if (cost <= 0) {
    addLog("装备无需修理");
    return;
  }
  if (state.gold < cost) {
    addLog("金币不足，无法修理");
    return;
  }
  state.gold -= cost;
  Object.values(state.equipment).forEach((equip) => {
    if (equip) equip.durability = data.equipmentById[equip.id].durability;
  });
  addLog(`修理完成 -${cost}金币`);
}

function feedActivePet() {
  const pet = activePet();
  if (!pet) return addLog("暂无出战宠物");
  if (!removeItem("pet_food")) return addLog("缺少灵宠口粮");
  pet.trust = clamp(pet.trust + 5, 0, 100);
  addLog(`${pet.name} 信赖提升`);
}

function canSpend(cost) {
  if (state.gold < (cost.gold || 0)) return false;
  return Object.entries(cost.materials || {}).every(([id, qty]) => itemCount(id) >= qty);
}

function spend(cost) {
  if (!canSpend(cost)) return false;
  state.gold -= cost.gold || 0;
  Object.entries(cost.materials || {}).forEach(([id, qty]) => removeItem(id, qty));
  return true;
}

function costText(cost) {
  const mats = Object.entries(cost.materials || {}).map(([id, qty]) => `${itemName(id)}x${qty}`).join(" ");
  return `${cost.gold || 0}金币${mats ? ` · ${mats}` : ""}`;
}

function enhanceEquipped(slot) {
  const equip = state.equipment[slot];
  if (!equip) return addLog("没有可加工装备");
  const next = (equip.plus || 0) + 1;
  const rule = data.enhancement.levels.find((item) => item.plus === next);
  if (!rule) return addLog("装备加工已达上限");
  if (!spend(rule)) return addLog(`材料不足：${costText(rule)}`);
  if (Math.random() <= rule.success) {
    equip.plus = next;
    addLog(`${data.equipmentById[equip.id].name} 加工 +${next}`);
    addFx(`加工 +${next}`, state.x, state.y - 82, "#ffe08a", "skill");
  } else {
    addLog("加工失败，装备未降级");
    addFx("加工失败", state.x, state.y - 82, "#ff9b7c", "status");
  }
  initVitals();
}

function socketEquipped(slot) {
  const equip = state.equipment[slot];
  if (!equip) return addLog("没有可打孔装备");
  if ((equip.sockets || 0) >= 2) return addLog("孔位已满");
  const rule = data.enhancement.socket;
  if (!spend(rule)) return addLog(`材料不足：${costText(rule)}`);
  equip.sockets = (equip.sockets || 0) + 1;
  addLog(`${data.equipmentById[equip.id].name} 打孔成功`);
  initVitals();
}

function soulEquipped(slot) {
  const equip = state.equipment[slot];
  if (!equip) return addLog("没有可附魂装备");
  if (equip.soul) return addLog("已经附魂");
  const rule = data.enhancement.soul;
  if (!spend(rule)) return addLog(`材料不足：${costText(rule)}`);
  equip.soul = true;
  addLog(`${data.equipmentById[equip.id].name} 附魂成功`);
  initVitals();
}

function trainActivePet() {
  const pet = activePet();
  if (!pet) return addLog("暂无出战宠物");
  const rule = data.petTraining.train;
  if (!spend(rule)) return addLog(`材料不足：${costText(rule)}`);
  pet.trust = clamp(pet.trust + rule.trust, 0, 100);
  pet.training = (pet.training || 0) + 1;
  pet.exp += rule.exp;
  feedPetExp(0);
  addLog(`${pet.name} 完成培育`);
}

function skillActivePet() {
  const pet = activePet();
  if (!pet) return addLog("暂无出战宠物");
  if ((pet.skillLevel || 1) >= data.petTraining.maxSkillLevel) return addLog("宠物技能已满级");
  const rule = { gold: data.petTraining.skillPill.gold, materials: { ...data.petTraining.skillPill.materials, skill_pill: 1 } };
  if (!spend(rule)) return addLog(`材料不足：${costText(rule)}`);
  pet.skillLevel = (pet.skillLevel || 1) + 1;
  addLog(`${pet.name} 技能升到 Lv.${pet.skillLevel}`);
}

function activatePetCircle() {
  const pet = activePet();
  if (!pet) return addLog("暂无出战宠物");
  if (pet.circle) return addLog("宠物法阵已激活");
  if (state.level < data.petTraining.circle.levelReq) return addLog("等级不足，无法开启法阵");
  if (!spend(data.petTraining.circle)) return addLog(`材料不足：${costText(data.petTraining.circle)}`);
  pet.circle = true;
  addLog(`${pet.name} 开启宠物法阵`);
  initVitals();
}

function advanceCharacter(key) {
  const rule = data.advancement[key];
  if (state.progression[key]) return addLog("已经完成该阶段");
  if (key === "ascension" && !state.progression.firstJob) return addLog("需先完成职业进阶");
  if (state.level < rule.levelReq) return addLog(`需要 Lv.${rule.levelReq}`);
  if (!spend(rule)) return addLog(`材料不足：${costText(rule)}`);
  state.progression[key] = true;
  addLog(`${data.classById[state.classId].name}${rule.titleSuffix}完成`);
  initVitals();
}

function runActivity(id) {
  const activity = data.activityById[id];
  if (!activity) return;
  resetActivityDay();
  if (state.activeActivity) return addLog(`正在进行：${data.activityById[state.activeActivity.id].name}`);
  const runs = state.activityRuns[id] || 0;
  if (state.level < activity.levelReq) return addLog("等级不足，无法开启日常");
  if (runs >= activity.dailyLimit) return addLog("今日次数已用完");
  state.activityRuns[id] = runs + 1;
  state.activeActivity = { id, progress: 0 };
  if (activity.dungeonId) enterDungeon(activity.dungeonId);
  else {
    const monster = monsterForLevel();
    const spawn = spawnForMonster(monster.id);
    setTarget(spawn.mapId, spawn.x, spawn.y, activity.name);
  }
  addLog(`开始日常：${activity.name}`);
}

function progressActivityKill() {
  if (!state.activeActivity) return;
  const activity = data.activityById[state.activeActivity.id];
  if (!activity?.target || activity.target.type !== "kill_any") return;
  state.activeActivity.progress += 1;
  if (state.activeActivity.progress >= activity.target.count) completeActivity(activity.id);
}

function completeActivity(id) {
  const activity = data.activityById[id];
  if (!activity) return;
  const reward = activity.rewards;
  addExp(reward.exp);
  state.gold += reward.gold;
  (reward.items || []).forEach((id) => addItem(id, 1));
  addLog(`完成日常：${activity.name}`);
  state.activeActivity = null;
}

function renderCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  const map = currentMap();
  const camera = {
    x: clamp(state.x - w / 2, 0, Math.max(0, map.size[0] - w)),
    y: clamp(state.y - h / 2, 0, Math.max(0, map.size[1] - h))
  };
  drawMap(w, h, camera);
  drawMarkers(camera);
  if (state.combat && (state.combat.enemyY || 0) > state.y) {
    drawPlayer(camera);
    drawCombatEnemy(camera);
  } else {
    drawCombatEnemy(camera);
    drawPlayer(camera);
  }
  drawFx(camera);
  drawCombatHud(w);
}

function drawMap(w, h, camera) {
  const map = currentMap();
  const profile = currentSceneProfile(map);
  const scene = sceneTheme(map.type, profile);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, scene.skyA);
  grad.addColorStop(1, scene.skyB);
  ctx.fillRect(0, 0, w, h);
  drawIsoGround(w, h, camera, scene, profile);
  drawMapWater(w, h, camera, profile);
  drawTerrainSignature(w, h, camera, scene, profile);
  drawSceneProps(w, h, camera, map.type, scene, profile);
  drawForegroundArchitecture(w, h, scene, profile);
  drawWeather(w, h, profile);
}

function currentSceneProfile(map = currentMap()) {
  const found = data.mapSceneById?.[map.id];
  if (found) return found;
  if (/通天|塔/.test(map.name)) return {
    theme: "tower",
    ground: ["#69606b", "#312b36", "#867866"],
    path: "#80716c",
    weather: "rain",
    props: [["rune", 470, 340, 1.5], ["lantern", 245, 250, 0.9], ["lantern", 820, 250, 0.9], ["gate", 780, 520, 0.95]]
  };
  if (/灵泽/.test(map.name)) return {
    theme: "spirit_hall",
    ground: ["#5f7773", "#2f454d", "#7e9b91"],
    path: "#879f96",
    water: "#4ca6a2",
    weather: "spirit",
    props: [["rune", 470, 340, 1.4], ["crystal", 250, 500, 1], ["crystal", 780, 245, 1]]
  };
  if (/龙翼|秘宝/.test(map.name)) return {
    theme: "dragon_relic",
    ground: ["#70614e", "#2e303a", "#aa8055"],
    path: "#9b7352",
    weather: "ember",
    props: [["rune", 470, 350, 1.5], ["crystal", 260, 520, 1], ["gate", 760, 260, 0.95]]
  };
  if (map.type === "main_city") return data.mapSceneById?.longcheng || {};
  if (map.type === "starter") return data.mapSceneById?.taoyuan_village || {};
  if (map.type === "dungeon") return data.mapSceneById?.dungeon_tower || {};
  return data.mapSceneById?.fangcao || {};
}

function sceneTheme(type, profile = {}) {
  if (profile.ground) {
    return { skyA: profile.ground[0], skyB: profile.ground[1], tileA: profile.ground[0], tileB: profile.ground[2], line: "rgba(67,82,61,.24)", roof: "#9b5b45", wall: "#d2b174", accent: "#dec467", path: profile.path || profile.ground[2] };
  }
  if (type === "main_city") {
    return { skyA: "#b9c2aa", skyB: "#65735f", tileA: "#a9ad9b", tileB: "#c4c1a9", line: "rgba(80,86,74,.28)", roof: "#9f5f48", wall: "#d7b37a", accent: "#e8c26c", path: "#d7c897" };
  }
  if (type === "starter") {
    return { skyA: "#a8bb94", skyB: "#62765b", tileA: "#a2aa8e", tileB: "#c0bd99", line: "rgba(73,87,67,.26)", roof: "#b56558", wall: "#e0bd7a", accent: "#e6c765", path: "#d7c897" };
  }
  if (type === "dungeon") {
    return { skyA: "#5c5264", skyB: "#2d2733", tileA: "#6e6371", tileB: "#82717d", line: "rgba(218,198,156,.18)", roof: "#7b4a55", wall: "#8c7a68", accent: "#d2a965", path: "#80716c" };
  }
  return { skyA: "#9fb28a", skyB: "#5f7556", tileA: "#9fa98a", tileB: "#c0bd96", line: "rgba(67,82,61,.24)", roof: "#9b6a47", wall: "#d0b279", accent: "#dec467", path: "#d7c897" };
}

function drawIsoGround(w, h, camera, scene, profile = {}) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, scene.tileB);
  base.addColorStop(0.55, scene.tileA);
  base.addColorStop(1, "#7f8e72");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#d8d1b2";
  ctx.lineWidth = 1;
  const gap = 56;
  for (let x = -w; x < w * 2; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x - (camera.x % gap), -20);
    ctx.lineTo(x + w * 0.7 - (camera.x % gap), h + 20);
    ctx.stroke();
  }
  ctx.strokeStyle = "#6f7a66";
  ctx.globalAlpha = 0.18;
  for (let x = -w; x < w * 2; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7 + (camera.y % gap), -20);
    ctx.lineTo(x + (camera.y % gap), h + 20);
    ctx.stroke();
  }
  ctx.restore();
  drawStonePaths(w, h, scene.path || profile.path);
}

function drawStonePaths(w, h, pathColor = "#d7c897") {
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = pathColor;
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-40, h * 0.78);
  ctx.bezierCurveTo(w * 0.28, h * 0.56, w * 0.56, h * 0.45, w + 60, h * 0.28);
  ctx.stroke();
  ctx.lineWidth = 18;
  ctx.strokeStyle = "#8c8c72";
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, -30);
  ctx.lineTo(w * 0.65, h + 30);
  ctx.stroke();
  ctx.restore();
}

function drawMapWater(w, h, camera, profile = {}) {
  if (!profile.water) return;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = profile.water;
  ctx.beginPath();
  ctx.ellipse(w * 0.08 - camera.x * 0.12, h * 0.15 - camera.y * 0.08, w * 0.42, h * 0.28, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(231,255,242,.45)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(w * 0.04 + i * 54, h * 0.2 + Math.sin(now() + i) * 6);
    ctx.quadraticCurveTo(w * 0.18 + i * 24, h * 0.13, w * 0.32 + i * 36, h * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTerrainSignature(w, h, camera, scene, profile = {}) {
  const theme = profile.theme || "grass";
  ctx.save();
  if (["city", "village"].includes(theme)) {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(70, 57, 43, .38)";
    ctx.lineWidth = 2;
    for (let y = 24 - (camera.y % 46); y < h; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y - 22);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(92, 64, 42, .55)";
    roundRect(w * 0.62, h * 0.08, w * 0.28, 28, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(126, 87, 53, .5)";
    roundRect(w * 0.66, h * 0.13, w * 0.22, 16, 6);
    ctx.fill();
  }
  if (["grass", "plain", "suburb", "deep_wood"].includes(theme)) {
    for (let i = 0; i < 34; i += 1) {
      const x = (Math.sin(i * 12.7 + camera.x * 0.01) * 0.5 + 0.5) * w;
      const y = (Math.cos(i * 8.9 + camera.y * 0.01) * 0.5 + 0.5) * h;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(219, 190, 111, .35)" : "rgba(52, 116, 54, .48)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.quadraticCurveTo(x + 4, y - 8, x + 12, y + 4);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(125, 96, 58, .28)";
    ctx.beginPath();
    ctx.ellipse(w * 0.64, h * 0.58, 120, 36, -0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  if (theme === "bamboo_water") {
    ctx.fillStyle = "rgba(64, 133, 90, .38)";
    roundRect(w * 0.74, h * 0.02, w * 0.24, h * 0.95, 18);
    ctx.fill();
    ctx.fillStyle = "rgba(238, 211, 128, .48)";
    ctx.beginPath();
    ctx.ellipse(w * 0.44, h * 0.62, 170, 46, -0.08, 0, Math.PI * 2);
    ctx.fill();
    drawLotusPatch(w * 0.14, h * 0.16, 1);
  }
  if (["tower", "nest", "spirit_hall", "dragon_relic"].includes(theme)) {
    ctx.fillStyle = "rgba(31, 24, 24, .32)";
    roundRect(26, 22, w - 52, h - 44, 14);
    ctx.fill();
    ctx.strokeStyle = theme === "tower" ? "rgba(255, 198, 124, .36)" : "rgba(125, 231, 255, .28)";
    ctx.lineWidth = 4;
    roundRect(38, 34, w - 76, h - 68, 14);
    ctx.stroke();
    if (theme === "dragon_relic") {
      ctx.fillStyle = "rgba(255, 123, 55, .12)";
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
    }
  }
  ctx.restore();
}

function drawLotusPatch(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = "rgba(93, 166, 110, .78)";
    ctx.beginPath();
    ctx.ellipse(i * 28, Math.sin(i) * 10, 18, 8, i * 0.4, 0, Math.PI * 2);
    ctx.fill();
    if (i % 2 === 0) {
      ctx.fillStyle = "#f5a6c8";
      ctx.beginPath();
      ctx.arc(i * 28 + 4, Math.sin(i) * 10 - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSceneProps(w, h, camera, type, scene, profile = {}) {
  const props = profile.props || (type === "main_city" || type === "starter"
    ? [
      [120, 430, 1.35, "shop"], [260, 500, 0.9, "stall"], [860, 250, 0.82, "gate"],
      [70, 210, 0.72, "lantern"], [1010, 520, 0.78, "tree"], [540, 170, 0.6, "well"]
    ]
    : [
      [160, 430, 0.9, "tree"], [380, 210, 0.7, "stone"], [760, 520, 0.85, "tree"],
      [960, 260, 0.65, "lantern"], [520, 440, 0.5, "well"]
    ]);
  props.forEach((prop) => {
    const [kind, wx, wy, scale] = typeof prop[0] === "string" ? prop : [prop[3], prop[0], prop[1], prop[2]];
    const x = wx - camera.x * 0.55;
    const y = wy - camera.y * 0.55;
    if (x < -180 || x > w + 180 || y < -160 || y > h + 160) return;
    if (kind === "shop") drawShop(x, y, scale, scene);
    if (kind === "stall") drawStall(x, y, scale, scene);
    if (kind === "gate") drawGate(x, y, scale, scene);
    if (kind === "tree") drawTree(x, y, scale);
    if (kind === "lantern") drawLantern(x, y, scale);
    if (kind === "well") drawWell(x, y, scale, scene);
    if (kind === "flower") drawFlowerPatch(x, y, scale);
    if (kind === "bush") drawBush(x, y, scale);
    if (kind === "bamboo") drawBamboo(x, y, scale);
    if (kind === "bridge") drawBridge(x, y, scale);
    if (kind === "rock" || kind === "stone") drawRock(x, y, scale);
    if (kind === "rune") drawGroundRune(x, y, scale);
    if (kind === "crystal") drawCrystal(x, y, scale);
    if (kind === "root") drawRoot(x, y, scale);
  });
}

function drawShop(x, y, s, scene) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath();
  ctx.ellipse(65, 82, 110, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = scene.wall;
  ctx.fillRect(-18, -6, 145, 88);
  ctx.fillStyle = scene.roof;
  ctx.beginPath();
  ctx.moveTo(-38, 0);
  ctx.quadraticCurveTo(48, -72, 147, 0);
  ctx.lineTo(120, 24);
  ctx.quadraticCurveTo(48, -24, -18, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6bd79";
  ctx.fillRect(18, 22, 42, 60);
  ctx.fillStyle = "rgba(75,45,32,.55)";
  ctx.fillRect(74, 18, 34, 28);
  ctx.restore();
}

function drawStall(x, y, s, scene) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.beginPath();
  ctx.ellipse(28, 62, 62, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = scene.roof;
  ctx.fillRect(-30, 0, 115, 24);
  ctx.fillStyle = "#d4aa61";
  ctx.fillRect(-18, 24, 92, 42);
  ctx.fillStyle = "#7d4b32";
  ctx.fillRect(-8, 38, 72, 12);
  ctx.restore();
}

function drawGate(x, y, s, scene) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.beginPath();
  ctx.ellipse(60, 110, 110, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = scene.wall;
  ctx.fillRect(-12, 18, 32, 92);
  ctx.fillRect(102, 18, 32, 92);
  ctx.fillStyle = scene.roof;
  ctx.beginPath();
  ctx.moveTo(-30, 18);
  ctx.lineTo(60, -38);
  ctx.lineTo(152, 18);
  ctx.lineTo(132, 38);
  ctx.lineTo(-12, 38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTree(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(8, 62, 48, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#835a35";
  ctx.fillRect(0, 18, 16, 46);
  ctx.fillStyle = "#4f8d4c";
  [-16, 8, 30].forEach((cx, i) => {
    ctx.beginPath();
    ctx.arc(cx, 8 + i * 5, 28, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLantern(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = "#6e4c2d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 70);
  ctx.lineTo(0, -6);
  ctx.lineTo(32, -6);
  ctx.stroke();
  ctx.fillStyle = "#d65e48";
  ctx.beginPath();
  ctx.ellipse(40, 6, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWell(x, y, s, scene) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.16)";
  ctx.beginPath();
  ctx.ellipse(0, 46, 50, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = scene.wall;
  ctx.beginPath();
  ctx.ellipse(0, 24, 36, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6e644f";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}

function drawFlowerPatch(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (let i = 0; i < 12; i += 1) {
    const px = Math.cos(i) * (18 + (i % 4) * 5);
    const py = Math.sin(i * 1.7) * 14;
    ctx.fillStyle = i % 2 ? "#f5a4ce" : "#fff1a5";
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fa85d";
    ctx.fillRect(px - 1, py + 4, 2, 12);
  }
  ctx.restore();
}

function drawBush(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.16)";
  ctx.beginPath();
  ctx.ellipse(6, 32, 56, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4e9850";
  [-22, 0, 22].forEach((cx, i) => {
    ctx.beginPath();
    ctx.arc(cx, 10 + i * 2, 24, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawBamboo(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = "#437d42";
  ctx.lineWidth = 7;
  [-20, 0, 20].forEach((cx, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, 78);
    ctx.quadraticCurveTo(cx + i * 5 - 4, 28, cx + 8, -38);
    ctx.stroke();
  });
  ctx.fillStyle = "#5ea95e";
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.ellipse(-26 + i * 8, -22 + (i % 3) * 20, 26, 6, -0.7 + i * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBridge(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.28);
  ctx.scale(s, s);
  ctx.fillStyle = "#9b6a3c";
  for (let i = 0; i < 6; i += 1) ctx.fillRect(-92 + i * 34, -20, 24, 72);
  ctx.strokeStyle = "#5f3a24";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-105, -24);
  ctx.lineTo(105, -24);
  ctx.moveTo(-105, 56);
  ctx.lineTo(105, 56);
  ctx.stroke();
  ctx.restore();
}

function drawRock(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.16)";
  ctx.beginPath();
  ctx.ellipse(10, 36, 52, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b7b0a0";
  ctx.beginPath();
  ctx.moveTo(-34, 34);
  ctx.lineTo(-18, -4);
  ctx.lineTo(22, -18);
  ctx.lineTo(48, 20);
  ctx.lineTo(20, 42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGroundRune(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = "rgba(145, 231, 255, .62)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 18, 74, 28, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 18, 34, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(Math.cos(i) * 64, 18 + Math.sin(i) * 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrystal(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(91, 213, 255, .22)";
  ctx.beginPath();
  ctx.arc(0, 30, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#87e7ff";
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(28, 12);
  ctx.lineTo(12, 58);
  ctx.lineTo(-26, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRoot(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = "#6e4931";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-20, 30);
    ctx.quadraticCurveTo(30 + i * 16, -10 + i * 12, 90 + i * 12, 10 + i * 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawForegroundArchitecture(w, h, scene, profile = {}) {
  if (w < 520 || h < 260 || !["village", "city"].includes(profile.theme)) return;
  ctx.save();
  ctx.translate(-28, h - 132);
  const scale = Math.min(1.05, Math.max(0.72, w / 840));
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath();
  ctx.ellipse(118, 140, 170, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6f4b3c";
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.ellipse(20 + i * 33, 86 + (i % 2) * 4, 22, 58, Math.PI / 2.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#332b2b";
  ctx.fillRect(10, 96, 250, 70);
  ctx.fillStyle = scene.wall;
  ctx.fillRect(40, 46, 210, 88);
  ctx.fillStyle = "#b55f4f";
  ctx.beginPath();
  ctx.moveTo(14, 50);
  ctx.quadraticCurveTo(110, -24, 250, 42);
  ctx.lineTo(222, 70);
  ctx.quadraticCurveTo(118, 22, 36, 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e0bd84";
  ctx.beginPath();
  ctx.roundRect?.(84, 12, 98, 44, 20);
  if (!ctx.roundRect) {
    roundRect(84, 12, 98, 44, 20);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(101,66,39,.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(58, 76, 42, 58);
  ctx.fillStyle = "#4b3428";
  ctx.fillRect(132, 78, 76, 36);
  ctx.fillStyle = "#f1d37e";
  ctx.fillRect(18, 118, 30, 48);
  ctx.restore();
}

function drawWeather(w, h, profile = {}) {
  const kind = profile.weather || "spark";
  const t = now();
  const count = kind === "rain" ? 42 : 22;
  for (let i = 0; i < count; i += 1) {
    const x = (Math.sin(i * 18.7 + t * 0.6) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 13.1 + t * 0.8) * 0.5 + 0.5) * h;
    const alpha = 0.25 + Math.abs(Math.sin(t * 2 + i)) * 0.4;
    if (kind === "rain") {
      ctx.strokeStyle = `rgba(218,235,255,${alpha * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x - 7, y + 12);
      ctx.stroke();
    } else if (kind === "mist") {
      ctx.fillStyle = `rgba(220,235,232,${alpha * 0.09})`;
      ctx.fillRect(x - 60, y, 120, 7);
    } else if (kind === "ember") {
      ctx.fillStyle = `rgba(255, 157, 77, ${alpha * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.3 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = kind === "spirit" ? `rgba(134, 233, 255, ${alpha * 0.65})` : `rgba(255, 239, 168, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMarkers(camera) {
  drawSpawnZoneHints(camera);
  data.npcs.filter((npc) => npc.mapId === state.mapId).forEach((npc) => {
    const x = npc.x - camera.x;
    const y = npc.y - camera.y;
    drawNpc(x, y, npc.name);
  });
  spawnInstancesForMap().forEach((spawn) => {
    if (spawn.uid === state.combat?.spawnUid) return;
    const x = spawn.x - camera.x;
    const y = spawn.y - camera.y;
    const monster = data.monsterById[spawn.monsterId];
    if (!monster) return;
    const size = monster.type === "boss" ? 78 : monster.type === "elite" ? 64 : 52;
    drawMonsterSprite(monster.id, x, y - 12 + Math.sin(now() * 2 + spawn.phase) * 2, size, size);
    drawHealthBar(x, y - 46, size, 0.95, monster.type === "boss" ? "#d84844" : "#e07962");
    ctx.fillStyle = "#ffe7a8";
    ctx.font = "700 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(monster.name, x, y + 32);
    ctx.textAlign = "left";
  });
  if (state.target) {
    ctx.strokeStyle = "#e9c66c";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(state.x - camera.x, state.y - camera.y);
    ctx.lineTo(state.target.x - camera.x, state.target.y - camera.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawSpawnZoneHints(camera) {
  data.spawns.filter((zone) => zone.mapId === state.mapId).forEach((zone) => {
    const x = zone.x - camera.x;
    const y = zone.y - camera.y;
    if (x < -220 || x > canvas.clientWidth + 220 || y < -160 || y > canvas.clientHeight + 160) return;
    const bossZone = zone.maxAlive === 1 || zone.monsterIds.some((id) => data.monsterById[id]?.type !== "normal");
    ctx.save();
    ctx.globalAlpha = bossZone ? 0.28 : 0.13;
    ctx.strokeStyle = bossZone ? "#ffcc74" : "#d8f2a0";
    ctx.lineWidth = bossZone ? 3 : 2;
    ctx.setLineDash(bossZone ? [8, 6] : [4, 8]);
    ctx.beginPath();
    ctx.ellipse(x, y, Math.min(120, zone.radius * 0.45), Math.min(42, zone.radius * 0.18), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (bossZone) {
      ctx.fillStyle = "rgba(255, 210, 116, .22)";
      ctx.beginPath();
      ctx.ellipse(x, y, 54, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawCombatEnemy(camera) {
  if (!state.combat) return;
  const enemy = state.combat.enemy;
  const flash = (enemy.hitFlash || 0) > now();
  const action = Math.max(0, (state.combat.enemyActionUntil || 0) - now());
  const shake = flash ? Math.sin(now() * 90) * 3 : 0;
  const baseX = Math.max(state.x + 104, state.combat.enemyX || state.x + 138);
  const baseY = (state.combat.enemyY || state.y - 4) - 8;
  const x = baseX - camera.x + shake + action * 22;
  const y = baseY - camera.y + Math.sin(now() * 4) * 1.2;
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  drawMonsterSprite(enemy.id, x, y - 2, 68, 68);
  if (flash) {
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "#fff6da";
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 31, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawHealthBar(x, y - 46, 76, enemy.hp / enemy.maxHp, "#df6b59");
  drawNameplate(enemy.name, x, y - 56, "#ffe08a");
  if (state.combat.lastSkillName && (state.combat.skillLabelUntil || 0) > now()) {
    drawCastLabel(state.combat.lastSkillName, x, y - 74);
  }
}

function drawFx(camera) {
  (state.fx || []).forEach((fx) => {
    const x = fx.x - camera.x;
    const y = fx.y - camera.y;
    const alpha = clamp(1 - fx.age / fx.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (fx.type === "beam") {
      const gradient = ctx.createLinearGradient(x, y - 42, x, y + 22);
      gradient.addColorStop(0, `rgba(255, 239, 151, 0)`);
      gradient.addColorStop(0.45, `rgba(255, 229, 104, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(255, 229, 104, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 10, y - 42, 20, 64);
    }
    if (fx.type === "projectile") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 8 - fx.age * 18, y + 8);
      ctx.quadraticCurveTo(x + 44, y - 34, x + 108, y - 18);
      ctx.stroke();
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(x + 102, y - 18, 5 + fx.age * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx.type === "shadowDash") {
      ctx.strokeStyle = `rgba(143, 93, 255, ${alpha * 0.72})`;
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 72 + fx.age * 54, y + 24);
      ctx.quadraticCurveTo(x - 18, y - 36, x + 56, y - 18);
      ctx.stroke();
      ctx.fillStyle = `rgba(26, 18, 42, ${alpha * 0.38})`;
      ctx.beginPath();
      ctx.ellipse(x - 26, y + 18, 34, 12, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx.type === "poisonTrail") {
      for (let i = 0; i < 10; i += 1) {
        ctx.fillStyle = `rgba(128,255,107,${alpha * (0.18 + i * 0.03)})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(i * 1.7 + fx.age * 4) * (18 + i * 2), y + 18 + Math.sin(i + fx.age * 5) * 12, 5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fx.type === "stun") {
      ctx.strokeStyle = `rgba(255, 235, 120, ${alpha * 0.9})`;
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(x, y - i * 10, 18 + i * 10 + fx.age * 8, 6 + i * 2, fx.age * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (fx.type === "ring" || fx.type === "aura") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.type === "ring" ? 4 : 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 20, 28 + fx.age * 32, 10 + fx.age * 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (fx.type === "rune") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 24, 32 + fx.age * 18, 11 + fx.age * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x, y + 24);
        ctx.lineTo(x + Math.cos(i + fx.age * 2) * 38, y + 24 + Math.sin(i + fx.age * 2) * 13);
        ctx.stroke();
      }
    }
    if (fx.type === "flame") {
      for (let i = 0; i < 7; i += 1) {
        ctx.fillStyle = i % 2 ? "rgba(255,210,83,.72)" : fx.color;
        ctx.beginPath();
        ctx.ellipse(x + i * 12, y + 10 - Math.sin(fx.age * 7 + i) * 18, 8, 20 + fx.age * 10, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fx.type === "ice") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(i) * 10, y + Math.sin(i) * 8);
        ctx.lineTo(x + Math.cos(i) * (55 + fx.age * 24), y + Math.sin(i) * (32 + fx.age * 16));
        ctx.stroke();
      }
    }
    if (fx.type === "poison") {
      ctx.fillStyle = `rgba(133,255,111,${alpha * 0.32})`;
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(i * 1.8) * (22 + fx.age * 20), y + Math.sin(i) * 18, 9 + fx.age * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fx.type === "light") {
      const g = ctx.createRadialGradient(x, y, 4, x, y, 62 + fx.age * 30);
      g.addColorStop(0, `rgba(255,255,210,${alpha * 0.8})`);
      g.addColorStop(1, "rgba(255,255,210,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 62 + fx.age * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx.type === "spear") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 28, y + 18);
      ctx.lineTo(x + 118, y - 30);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,.75)";
      ctx.stroke();
    }
    if (fx.type === "petClaw") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x - 16 + i * 14, y - 24);
        ctx.quadraticCurveTo(x + 4 + i * 8, y - 2, x - 4 + i * 12, y + 24);
        ctx.stroke();
      }
    }
    if (fx.type === "burst") {
      ctx.strokeStyle = `rgba(255, 213, 94, ${alpha * 0.85})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 10 + fx.age * 34, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (fx.type === "slash" || fx.type === "impact") {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.type === "slash" ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(x - 24, y - 16);
      ctx.quadraticCurveTo(x, y - 34, x + 24, y - 12);
      ctx.stroke();
    }
    if (fx.type === "drop") {
      ctx.fillStyle = `rgba(255, 221, 101, ${alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, y + 18, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx.text) {
      ctx.textAlign = "center";
      ctx.font = fx.type === "crit" ? "900 20px system-ui" : fx.type === "damage" ? "800 16px system-ui" : "700 13px system-ui";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(35, 22, 16, .72)";
      ctx.strokeText(fx.text, x, y);
      ctx.fillStyle = fx.color;
      ctx.fillText(fx.text, x, y);
    }
    ctx.restore();
  });
  ctx.textAlign = "left";
}

function drawNpc(x, y, name) {
  ctx.fillStyle = "rgba(0,0,0,.24)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 25, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d6a84f";
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5e6a9";
  ctx.fillRect(x - 12, y + 10, 24, 28);
  drawNameplate(name, x, y - 20, "#ffe38b");
}

function drawPlayer(camera) {
  const flash = (state.hitFlash || 0) > now();
  const combat = state.combat;
  const action = Math.max(0, (combat?.playerActionUntil || 0) - now());
  const shake = flash ? Math.sin(now() * 100) * 2 : 0;
  const x = state.x - camera.x + shake + action * 42;
  const y = state.y - camera.y + Math.sin(now() * 4.6) * 1.4;
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  drawNameplate(`${state.name}`, x, y - 56, "#f4d36f");
  drawSprite(`character_${state.classId}`, x, y - 6, 68, 80);
  if (flash) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#ffefe4";
    ctx.beginPath();
    ctx.ellipse(x, y - 6, 27, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawHealthBar(x, y - 38, 72, state.hp / getStats().maxHp, "#80d86e");
  const pet = activePet();
  if (pet) {
    const petAction = Math.max(0, (combat?.petActionUntil || 0) - now());
    drawMonsterSprite("white_rabbit", x + 54 + petAction * 52, y + 8, 42, 42);
    drawNameplate(pet.name, x + 54, y - 26, "#cbe9ff");
  }
  ctx.textAlign = "left";
}

function drawCastLabel(text, x, y) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "800 11px system-ui";
  const width = Math.min(92, Math.max(46, ctx.measureText(text).width + 18));
  ctx.fillStyle = "rgba(34, 23, 18, .72)";
  roundRect(x - width / 2, y - 13, width, 18, 8);
  ctx.fill();
  ctx.fillStyle = "#fff1ac";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawNameplate(text, x, y, color) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "700 12px system-ui";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(44,24,20,.65)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawHealthBar(x, y, width, value, color) {
  ctx.fillStyle = "rgba(55,34,22,.62)";
  roundRect(x - width / 2, y, width, 7, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(x - width / 2 + 1, y + 1, (width - 2) * clamp(value, 0, 1), 5, 3);
  ctx.fill();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCombatHud(w) {
  if (!state.combat) return;
  const enemy = state.combat.enemy;
  ctx.fillStyle = "rgba(54, 32, 22, 0.72)";
  roundRect(w / 2 - 120, 24, 240, 42, 10);
  ctx.fill();
  ctx.fillStyle = "#fff7dc";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${enemy.name} Lv.${enemy.level}`, w / 2, 42);
  drawHealthBar(w / 2, 50, 190, enemy.hp / enemy.maxHp, "#df6b59");
  ctx.textAlign = "left";
}

function drawMonsterSprite(monsterId, x, y, w, h) {
  drawSprite(monsterId, x, y, w, h);
}

function drawSprite(assetId, x, y, w, h) {
  const asset = data.qAssetById[assetId];
  const img = asset ? spriteImages[asset.id] : null;
  if (img?.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    return;
  }
  ctx.fillStyle = "#d96f61";
  ctx.beginPath();
  ctx.arc(x, y, Math.min(w, h) / 2, 0, Math.PI * 2);
  ctx.fill();
}

function onCanvasTap(event) {
  const rect = canvas.getBoundingClientRect();
  const map = currentMap();
  const camera = {
    x: clamp(state.x - rect.width / 2, 0, Math.max(0, map.size[0] - rect.width)),
    y: clamp(state.y - rect.height / 2, 0, Math.max(0, map.size[1] - rect.height))
  };
  state.target = {
    mapId: state.mapId,
    x: clamp(event.clientX - rect.left + camera.x, 0, map.size[0]),
    y: clamp(event.clientY - rect.top + camera.y, 0, map.size[1]),
    label: "手动目的地"
  };
  state.manualUntil = now() + 8;
  state.autoPath = true;
  renderGame();
}

function gameLoop(time) {
  const dt = Math.min(0.08, (time - lastTime) / 1000);
  lastTime = time;
  tick(dt);
  renderCanvas();
  requestAnimationFrame(gameLoop);
}

async function boot() {
  await loadData();
  state = loadSave();
  if (state) {
    initVitals();
    renderGameShell();
  } else {
    renderCreate();
  }
  requestAnimationFrame(gameLoop);
}

boot();
