import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "docs/reference/structured/pet_catalog_ffobaike.json";
const outputPath = "data/design/pet_runtime_catalog.json";

function catalogRole(name, desc = "") {
  const text = `${name} ${desc}`;
  if (/马|骑|坐骑|鹿|驹|麒麟|凤凰|翼|飞|龙/.test(text)) return "mount_or_rare";
  if (/神|仙|灵|王|皇|魔|妖|圣|黄金|暗黑|狂/.test(text)) return "rare_combat";
  if (/兔|猫|狗|熊|鸟|蝎|蛇|蝶|鱼/.test(text)) return "combat_pet";
  return "collection_pet";
}

function unlockSource(name, uid) {
  if (/黄金|圣|神|秘|极|幻|魔/.test(name)) return "endgame_activity_or_event";
  if (uid <= 40) return "starter_or_wild_capture";
  if (uid <= 180) return "midgame_activity_or_dungeon";
  return "endgame_collection";
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const detailsByUid = Object.fromEntries(Object.values(source.details || {}).map((detail) => [detail.uid, detail]));
const pets = (source.list || []).map((item) => {
  const detail = detailsByUid[item.uid] || {};
  const role = catalogRole(item.name, detail.desc);
  return {
    id: `ffo_pet_${item.uid}`,
    catalog_uid: item.uid,
    original_uid: item.uid,
    original_id: item.id,
    original_name: item.name,
    project_name: item.name,
    catalog_desc: detail.desc || "",
    reference_apng_count: detail.apng_count || 0,
    traits: item.traits || "",
    catalog_role: role,
    unlock_source: unlockSource(item.name, item.uid),
    runtime_enabled: false,
    gameplay_status: "catalog_only",
    source_file: sourcePath,
    source_confidence: "wiki",
    gaps: [
      "捕捉点/获得方式未全量结构化",
      "食性未结构化",
      "资质成长数值未结构化",
      "专属技能池未结构化",
      "base.hp/attack/defense 未结构化，禁止进入出战宠物列表"
    ]
  };
});

const catalog = {
  schema_version: "p3-agent-loop-03",
  generated_from: sourcePath,
  source_confidence: "wiki",
  policy: "运行目录只保留全量宠物图鉴身份、描述、素材参考和目录分类；未补齐 base/catchFrom/levelReq/growthType/skill 前不得捕捉、出战或参与战斗。",
  count: pets.length,
  runtime_enabled_count: pets.filter((pet) => pet.runtime_enabled).length,
  catalog_roles: [...new Set(pets.map((pet) => pet.catalog_role))],
  unlock_sources: [...new Set(pets.map((pet) => pet.unlock_source))],
  source_integrity: {
    list_count: source.list?.length || 0,
    detail_count: Object.keys(source.details || {}).length,
    failed_details: source.failed_details || []
  },
  pets
};

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
