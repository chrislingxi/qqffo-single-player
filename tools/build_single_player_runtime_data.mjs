import { readFile, writeFile } from "node:fs/promises";

const forbiddenTerms = ["排行", "队伍", "组队", "交易", "可交易", "玩家相互", "好友", "空间", "帮派", "家族", "社交", "竞争"];
const fillerTerms = new Set(["图标", "物", "注意", "参考资料", "Pager", "名称", "位置", "合成方式", "所需材料", "方式一", "方式二", "方式三", "手套", "面饰", "戒指", "项链"]);
const sourceNoisePattern = /官网|上一页|下一页|专题页|背景故事|副本地图|副本视频|施工中|怪物特性|适合.*职业|点击|加载中|每日小知识|参考|资料|属性数据|数据来源/;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasForbiddenText(value) {
  return forbiddenTerms.some((term) => normalizeText(value).includes(term));
}

function removedTerms(values) {
  const text = values.map(normalizeText).join(" ");
  return forbiddenTerms.filter((term) => text.includes(term));
}

function isCleanRuntimeLabel(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (text.startsWith("[图片:")) return false;
  if (fillerTerms.has(text)) return false;
  if (hasForbiddenText(text)) return false;
  if (sourceNoisePattern.test(text)) return false;
  if (/[=＝*×]/.test(text)) return false;
  if (/规则|公式|材料|方式|点击|说明|属性：|技能：/.test(text)) return false;
  if (text.length > 24 && /[，。；！]/.test(text)) return false;
  if (/^这次|玩家可以|若|提示|目前|欢迎|根据|打开/.test(text)) return false;
  return true;
}

function cleanLabels(values, limit = 16) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = normalizeText(value);
    if (!isCleanRuntimeLabel(text) || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function singlePlayerFrequency(value) {
  const text = normalizeText(value);
  if (text.includes("每天免费1次")) {
    return {
      mode: "daily",
      free_entries: 1,
      extra_entry: "local_endgame_key",
      display: "每天免费1次；单机钥匙可追加挑战"
    };
  }
  if (!text || hasForbiddenText(text)) {
    return {
      mode: "local_rule",
      free_entries: 1,
      extra_entry: "local_endgame_key",
      display: "单机挑战次数按本地日常规则配置"
    };
  }
  return {
    mode: "source_text_structured",
    free_entries: null,
    extra_entry: "local_endgame_key",
    display: text
  };
}

function sanitizeDungeons(data) {
  data.schema_version = "p3-agent-loop-02";
  data.runtime_policy = "records.*.drops/frequency 保留资料原文；游戏 UI 和玩法逻辑只能使用 single_player_runtime。";
  data.records = (data.records || []).map((record) => {
    const rawDrops = record.drops || [];
    const rawText = [...rawDrops, record.frequency || ""];
    const displayRewards = cleanLabels(rawDrops, 18);
    const displayBosses = cleanLabels(record.bosses || [], 8);
    return {
      ...record,
      single_player_runtime: {
        entry_mode: "solo",
        party_requirement: "none",
        multiplayer_removed: true,
        frequency_rule: singlePlayerFrequency(record.frequency),
        frequency_display: singlePlayerFrequency(record.frequency).display,
        display_bosses: displayBosses.length ? displayBosses : cleanLabels([record.original_name], 1),
        display_rewards: displayRewards,
        reward_count_from_source: rawDrops.length,
        source_terms_removed_count: removedTerms(rawText).length,
        source_text_policy: "原始资料只作考据；运行 UI 不读取 drops 原文。"
      }
    };
  });
  return data;
}

function sanitizeMaterials(data) {
  data.schema_version = "p3-agent-loop-02";
  data.runtime_policy = "materials 保留候选资料；runtime_materials 是单机运行可展示/可掉落材料清单。";
  data.materials = (data.materials || []).map((material) => {
    const label = normalizeText(material.project_name || material.original_name);
    const runtimeEnabled = isCleanRuntimeLabel(label) && label.length <= 18;
    return {
      ...material,
      runtime_enabled: runtimeEnabled,
      source_text_policy: runtimeEnabled ? "runtime_safe_label" : "source_only_needs_structuring"
    };
  });
  data.runtime_materials = data.materials
    .filter((material) => material.runtime_enabled)
    .map((material) => ({
      id: material.id,
      original_name: normalizeText(material.original_name),
      project_name: normalizeText(material.project_name || material.original_name),
      used_by: material.used_by || [],
      single_player_sources: material.single_player_sources || [],
      source_confidence: material.source_confidence
    }));
  return data;
}

function sanitizeActivities(data) {
  data.schema_version = "p3-agent-loop-02";
  data.runtime_policy = "activities 保留来源说明；single_player_runtime 给游戏使用。";
  data.activities = (data.activities || []).map((activity) => ({
    ...activity,
    single_player_runtime: {
      entry_mode: "solo",
      party_requirement: "none",
      removed_system_codes: ["party", "ranking", "trade"],
      assist_replacement: "宠物/幻神助战或本地战力门槛",
      source_text_policy: "single_player_adaptation 是设计说明；运行 UI 使用 single_player_runtime。"
    }
  }));
  return data;
}

const dungeonPath = "data/design/endgame_dungeons.json";
const materialPath = "data/design/endgame_materials.json";
const activityPath = "data/design/full_activity_catalog.json";

await writeJson(dungeonPath, sanitizeDungeons(await readJson(dungeonPath)));
await writeJson(materialPath, sanitizeMaterials(await readJson(materialPath)));
await writeJson(activityPath, sanitizeActivities(await readJson(activityPath)));
