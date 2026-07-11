import { readFile, writeFile } from "node:fs/promises";

const bossPath = "data/design/endgame_bosses.json";
const outputPath = "data/design/runtime_endgame_dungeons.json";

function slug(value) {
  return String(value || "")
    .replace(/[·\s]+/g, "_")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9_+-]/g, "")
    .slice(0, 36);
}

const levelPlan = {
  夜影村: 55,
  迷雾沼泽: 62,
  冰火双螺: 68,
  灵泽殿: 74,
  先祖山: 80,
  八仙东海战: 86,
  妖皇府: 92,
  昆仑雪: 98,
  通天魔劫塔: 100
};

function statsFor(level, role, index) {
  const bossScale = role === "boss" ? 1.9 : role === "elite" ? 1.35 : 1;
  return {
    hp: Math.round((2200 + level * level * 6.4 + index * 260) * bossScale),
    attack: Math.round((115 + level * 8.2 + index * 13) * (role === "boss" ? 1.18 : 1)),
    defense: Math.round(42 + level * 2.7 + index * 6),
    exp: Math.round((680 + level * 56 + index * 220) * bossScale)
  };
}

function rewardItems(index) {
  const plans = [
    ["soul_charm", "socket_stone"],
    ["skill_pill", "soul_charm"],
    ["repair_kit", "socket_stone"],
    ["pet_food", "skill_pill"]
  ];
  return plans[index % plans.length];
}

const source = JSON.parse(await readFile(bossPath, "utf8"));
const bossesByDungeon = source.bosses.reduce((acc, boss) => {
  acc[boss.dungeon_id] ||= [];
  acc[boss.dungeon_id].push(boss);
  return acc;
}, {});

const maps = [];
const monsters = [];
const dungeons = source.dungeons.map((dungeon, dungeonIndex) => {
  const originalName = dungeon.original_name;
  const levelReq = levelPlan[originalName] || 80;
  const runtimeId = dungeon.id.replace("endgame_", "runtime_endgame_");
  const entryMap = "lingze_field";
  const dungeonBosses = bossesByDungeon[dungeon.id] || [];
  const selectedBosses = dungeonBosses;
  const monsterIds = selectedBosses.map((boss, index) => {
    const monsterId = `${runtimeId}_monster_${index + 1}_${slug(boss.original_name)}`;
    const role = boss.role || boss.type || "boss";
    const stat = statsFor(levelReq + Math.min(index, 10), role, index);
    monsters.push({
      id: monsterId,
      name: boss.project_name.replace("·单机", ""),
      original_name: boss.original_name,
      type: role === "boss" ? "boss" : "elite",
      level: levelReq + Math.min(index, 10),
      hp: stat.hp,
      attack: stat.attack,
      defense: stat.defense,
      exp: stat.exp,
      mapIds: [runtimeId],
      drops: rewardItems(dungeonIndex),
      source_files: boss.source_files,
      asset_refs: boss.asset_refs || [],
      source_confidence: boss.source_confidence,
      stat_confidence: "single_player_balance",
      gaps: boss.gaps
    });
    return monsterId;
  });
  maps.push({
    id: runtimeId,
    name: `${originalName}·单机试打`,
    original_name: originalName,
    type: "dungeon",
    levelRange: [levelReq, Math.min(110, levelReq + 10)],
    size: [980, 720],
    connections: [entryMap],
    source_files: dungeon.source_files,
    source_confidence: dungeon.source_confidence,
    art_status: "needs_ai_qstyle_map",
    notes: "Loop04 单机运行适配地图，地图美术仍需基于本地原图AI二创。"
  });
  const waves = monsterIds.map((id) => ({
    monsterIds: [id],
    count: 1
  }));
  return {
    id: runtimeId,
    name: `${originalName}·单机试打`,
    original_name: originalName,
    levelReq,
    entryMap,
    waves,
    rewards: {
      exp: Math.round(9000 + levelReq * 860 + monsterIds.length * 4200),
      gold: Math.round(2800 + levelReq * 120),
      items: rewardItems(dungeonIndex)
    },
    source_confidence: "single_player_runtime_adapter",
    source_dungeon_id: dungeon.id,
    single_player_balance: true,
    mechanics: {
      boss_count_source: dungeonBosses.length,
      runtime_wave_count: waves.length,
      entry_mode: "solo",
      auto_battle_supported: true,
      revive_pool: originalName === "通天魔劫塔" ? 5 : 3,
      timer_seconds: originalName === "通天魔劫塔" ? 300 : null
    },
    gaps: [
      "血量/攻击/防御为单机平衡模板，非官方原始数值",
      "BOSS技能时间轴待结构化",
      "精确掉落权重待结构化",
      "地图与BOSS美术待AI Q版化"
    ]
  };
});

const output = {
  schema_version: "p3-agent-loop-04",
  generated_from: bossPath,
  policy: "把高阶副本目录适配成当前单机副本引擎可运行的数据。所有数值均标 single_player_balance，不冒充官方完整资料。",
  dungeon_count: dungeons.length,
  monster_count: monsters.length,
  map_count: maps.length,
  maps,
  monsters,
  dungeons
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
