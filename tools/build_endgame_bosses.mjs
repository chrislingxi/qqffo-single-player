import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const sourcePath = "data/design/endgame_dungeons.json";
const outputPath = "data/design/endgame_bosses.json";
const assetRoot = "docs/reference/assets/entity_localized/dungeon_boss_or_monster";

function slug(value) {
  return String(value || "")
    .replace(/[·\s]+/g, "_")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9_+-]/g, "")
    .slice(0, 32);
}

function bossType(name) {
  if (/王|皇|主|神|魔|BOSS|水魔|朱雀|龙/.test(name)) return "boss";
  if (/精英|魂|侍|将|护法/.test(name)) return "elite";
  return "encounter";
}

function pworldId(record) {
  const mdPath = record.local_paths?.[0] || "";
  return basename(mdPath).replace(/\.md$/i, "");
}

function assetName(file) {
  return basename(file)
    .replace(/^\d+-/, "")
    .replace(/-[0-9a-f]{8,}(?=\.[^.]+$)/i, "")
    .replace(/\.[^.]+$/, "");
}

function uniqueByName(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.name.replace(/[·-]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const forcedBossNames = {
  "pworld-lingzedian": ["蛟龙神", "双头恶蛟"],
  "pworld-kunlunxue": ["青鸟探路", "首领雪狼之主", "首领毒龙", "妖母", "首领火窟盗君", "三圣兽朱雀", "三圣兽玄武", "三圣兽青龙"],
  "pworld-tongtianmojieta": ["通天魔劫塔守关BOSS"]
};

const forcedGaps = {
  "pworld-lingzedian": ["本地未找到实体图片目录，BOSS 名称来自结构化审计，掉落表/召唤条件待补"],
  "pworld-kunlunxue": ["本地图片目录只含青鸟探路/昆仑雪，其他首领名称来自结构化审计，图片待补"],
  "pworld-tongtianmojieta": ["本地资料确认30层与300秒限时，但逐层BOSS名单待补，当前仅保留守关BOSS占位"]
};

const noiseTerms = /图谱|碎片|宝石|之魂|魂石|幻化书|宝盒|宝藏|秘宝|谢礼|地图|背景故事|副本|规则|体验|场景|胸针|项链|戒指|吊坠|指环|手|面|翼|环|坠|链|络|镶|拂|魄|裂|首|形|凝视|无双|升级|融合|产物|概率|施工|视频|秘-|卡片|卡魂|功能|昆仑雪$|闪灵|轻灵|魔能|冲击|破魂|擎力/;
const knownSceneNames = /^(夜影村|妖皇府|先祖山|通天魔劫塔|龙宫宝藏|瑶池酒会战斗场景|寻仙迹|太白仙翁降临猫猫城|赤枭巢穴|赤枭出没地|八仙的结界|花妖)$/;
const monsterTerms = /王|皇|主|神|魔|妖|龙|鬼|灵|鸟|蝎|侍|骑兵|将军|术士|剑客|恶狼|死神|公主|护法|鱼人|珊瑚|朱雀|玄武|青龙|母|犬|人形态|熊形态|树妖|骨龙|罗刹|蛇|水魔|巫术者|巡卫|钢拳|利爪|鬼影|暗袭人|莲姬|幽冥兽|探路/;

function isLikelyEncounter(name, dungeonName) {
  if (!name || name === dungeonName) return false;
  if (knownSceneNames.test(name)) return false;
  if (noiseTerms.test(name)) return false;
  return monsterTerms.test(name);
}

async function assetBossEntries(record) {
  const id = pworldId(record);
  const dir = join(assetRoot, id);
  try {
    const files = await readdir(dir);
    return uniqueByName(files.map((file) => ({
      name: assetName(file),
      asset_ref: join(dir, file),
      confidence: "confirmed"
    })).filter((entry) => isLikelyEncounter(entry.name, record.original_name)));
  } catch {
    return [];
  }
}

function mechanicsFromText(record, bossName) {
  const text = `${record.original_name} ${bossName} ${(record.drops || []).join(" ")}`;
  const mechanics = [];
  if (/隐藏BOSS|隐藏/.test(text)) mechanics.push("hidden_boss_condition");
  if (/物理防御较高/.test(text)) mechanics.push("high_physical_defense");
  if (/魔法防御较高/.test(text)) mechanics.push("high_magic_defense");
  if (/恶魔/.test(text)) mechanics.push("demon_damage_bonus");
  if (/300秒|限时/.test(text)) mechanics.push("boss_timer");
  if (/召唤/.test(text)) mechanics.push("summon_disabled_or_single_player_adjusted");
  return mechanics.length ? mechanics : ["solo_dps_check"];
}

function rewardGroups(record) {
  const rewards = record.single_player_runtime?.display_rewards || [];
  const materials = rewards.filter((item) => /碎片|宝石|魂|图谱|药|绫|丸|印记|晶石/.test(item));
  const equipment = rewards.filter((item) => !materials.includes(item));
  return [
    {
      id: `${record.id}_materials`,
      type: "materials",
      items: materials.slice(0, 16),
      source_confidence: record.source_confidence || "partial"
    },
    {
      id: `${record.id}_equipment`,
      type: "equipment_or_cosmetic",
      items: equipment.slice(0, 16),
      source_confidence: record.source_confidence || "partial"
    }
  ].filter((group) => group.items.length);
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const bosses = [];
const dungeons = [];

for (const record of source.records || []) {
  const localEntries = await assetBossEntries(record);
  const forced = (forcedBossNames[pworldId(record)] || []).map((name) => ({
    name,
    asset_ref: "",
    confidence: "partial"
  }));
  const fallback = (record.single_player_runtime?.display_bosses || []).map((name) => ({
    name,
    asset_ref: "",
    confidence: "partial"
  })).filter((entry) => isLikelyEncounter(entry.name, record.original_name));
  const entries = uniqueByName([...localEntries, ...forced, ...fallback]);
  const bossIds = entries.map((entry, index) => {
    const name = entry.name;
    const id = `${record.id}_boss_${index + 1}_${slug(name)}`;
    bosses.push({
      id,
      dungeon_id: record.id,
      original_name: name,
      project_name: `${name}·单机`,
      type: bossType(name),
      role: bossType(name),
      level_requirement: record.level_requirement || "unknown",
      mechanics: mechanicsFromText(record, name),
      single_player_rules: {
        entry_mode: "solo",
        party_requirement: "none",
        auto_battle_supported: true,
        fail_condition: record.single_player_runtime?.frequency_rule?.mode === "daily" ? "daily_entry_or_revive_limit" : "local_revive_limit"
      },
      source_files: record.local_paths || [],
      asset_refs: entry.asset_ref ? [entry.asset_ref] : [],
      source_confidence: entry.confidence || record.source_confidence || "partial",
      gaps: [
        "血量/攻击/防御数值待结构化",
        "技能时间轴待结构化",
        "精确掉落权重待结构化"
      ].concat(entry.asset_ref ? [] : ["运行美术素材待AI二创Q版化"])
    });
    return id;
  });
  dungeons.push({
    id: record.id,
    original_name: record.original_name,
    project_name: record.project_name,
    level_requirement: record.level_requirement || "unknown",
    entry_npc: record.entry_npc || "",
    frequency_rule: record.single_player_runtime?.frequency_rule || null,
    boss_ids: bossIds,
    reward_groups: rewardGroups(record),
    source_confidence: record.source_confidence || "partial",
    source_files: record.local_paths || [],
    asset_directory: join(assetRoot, pworldId(record)),
    gaps: [...(record.gaps || []), ...(forcedGaps[pworldId(record)] || [])]
  });
}

const output = {
  schema_version: "p3-agent-loop-03",
  generated_from: sourcePath,
  policy: "从 endgame_dungeons 的运行安全字段拆出单机副本/BOSS/奖励组；不使用 raw drops 作为运行 UI。",
  dungeon_count: dungeons.length,
  boss_count: bosses.length,
  dungeons,
  bosses
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
