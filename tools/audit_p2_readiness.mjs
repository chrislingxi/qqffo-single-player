import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "test-results");

async function load(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

const [
  quests,
  classes,
  skills,
  equipment,
  pets,
  dungeons,
  activities,
  maps,
  monsters,
  enhancement,
  petTraining
] = await Promise.all([
  load("data/design/quests.json"),
  load("data/design/classes.json"),
  load("data/design/skills.json"),
  load("data/design/equipment.json"),
  load("data/design/pets.json"),
  load("data/design/dungeons.json"),
  load("data/design/activities.json"),
  load("data/design/maps.json"),
  load("data/design/monsters.json"),
  load("data/design/enhancement_rules.json"),
  load("data/design/pet_training.json")
]);

const by = (items, key) => items.reduce((acc, item) => {
  const value = item[key] || "missing";
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {});

const unique = (items) => [...new Set(items.filter(Boolean))];
const countWhere = (items, predicate) => items.filter(predicate).length;

function confidenceStats(items, field = "source_confidence") {
  const stats = by(items, field);
  const total = items.length || 1;
  const strong = (stats.official || 0) + (stats.mixed || 0) + (stats.official_name_inferred_rule || 0);
  return {
    total: items.length,
    ...stats,
    strongRatio: Number((strong / total).toFixed(3))
  };
}

const chainCounts = by(quests, "chain");
const objectiveCounts = by(quests.map((quest) => ({ type: quest.objective?.type })), "type");
const mainQuests = quests.filter((quest) => quest.chain === "main");
const careerQuests = quests.filter((quest) => quest.chain === "career");
const questLevelBands = {
  lv1_10: countWhere(quests, (quest) => quest.levelReq >= 1 && quest.levelReq <= 10),
  lv11_20: countWhere(quests, (quest) => quest.levelReq >= 11 && quest.levelReq <= 20),
  lv21_35: countWhere(quests, (quest) => quest.levelReq >= 21 && quest.levelReq <= 35),
  lv36_55: countWhere(quests, (quest) => quest.levelReq >= 36 && quest.levelReq <= 55),
  lv56_80: countWhere(quests, (quest) => quest.levelReq >= 56 && quest.levelReq <= 80)
};

const mechanics = {
  skill: {
    evidence: skills.length,
    guidedByQuest: quests.some((quest) => /技能|学习|加点/.test(`${quest.title}${quest.notes || ""}`))
  },
  attributePoints: {
    evidence: classes.filter((classDef) => classDef.autoPointPerLevel).length,
    guidedByQuest: quests.some((quest) => /属性|加点|力量|智慧|体质|敏捷|精神/.test(`${quest.title}${quest.notes || ""}`))
  },
  equipment: {
    evidence: equipment.length,
    guidedByQuest: quests.some((quest) => /装备|武器|防具|加工|镶嵌|附魂/.test(`${quest.title}${quest.notes || ""}`))
  },
  pet: {
    evidence: pets.length,
    guidedByQuest: quests.some((quest) => quest.objective?.type === "catch_pet" || /宠物|灵宠|捕捉|信赖|培育/.test(`${quest.title}${quest.notes || ""}`))
  },
  dungeon: {
    evidence: dungeons.length,
    guidedByQuest: quests.some((quest) => quest.objective?.type === "dungeon" || /副本|宝塔|巢穴|试炼/.test(`${quest.title}${quest.notes || ""}`))
  },
  enhancement: {
    evidence: enhancement.levels?.length || 0,
    guidedByQuest: quests.some((quest) => /加工|打孔|镶嵌|附魂|强化/.test(`${quest.title}${quest.notes || ""}`))
  },
  dailyActivities: {
    evidence: activities.length,
    guidedByQuest: quests.some((quest) => /日常|猎杀令|通天塔|试炼|珍珠|保卫/.test(`${quest.title}${quest.notes || ""}`))
  },
  petTraining: {
    evidence: petTraining.maxSkillLevel || 0,
    guidedByQuest: quests.some((quest) => /技能丸|法阵|喂养|信赖|培育/.test(`${quest.title}${quest.notes || ""}`))
  }
};

const issues = [];
function gate(ok, id, severity, message, evidence) {
  if (!ok) issues.push({ id, severity, message, evidence });
}

gate(quests.length >= 45, "p2.quest.volume", "critical", "P2 任务量不足，无法支撑 30 分钟以上连续任务牵引。", { current: quests.length, target: ">=45" });
gate(mainQuests.length >= 20, "p2.quest.main_chain", "critical", "主线任务链过短，不能承担前期主牵引。", { current: mainQuests.length, target: ">=20" });
gate(chainCounts.side >= 12, "p2.quest.side_chain", "high", "支线任务不足，自由幻想式地图/NPC/收集牵引不够。", { current: chainCounts.side || 0, target: ">=12" });
gate(careerQuests.length >= classes.length * 2, "p2.quest.career_depth", "high", "职业任务深度不足，五职业缺少差异化学习和转职牵引。", { current: careerQuests.length, target: `>=${classes.length * 2}` });
gate((chainCounts.repeat || 0) >= 6, "p2.quest.repeatable", "medium", "循环任务不足，中期刷怪和资源循环牵引弱。", { current: chainCounts.repeat || 0, target: ">=6" });
gate(objectiveCounts.kill && objectiveCounts.collect && objectiveCounts.talk && objectiveCounts.dungeon && objectiveCounts.catch_pet, "p2.quest.objective_mix", "high", "任务目标类型覆盖不完整，玩法节奏容易单调。", objectiveCounts);
gate(questLevelBands.lv1_10 >= 8 && questLevelBands.lv11_20 >= 10 && questLevelBands.lv21_35 >= 10 && questLevelBands.lv36_55 >= 8, "p2.quest.level_bands", "critical", "任务等级段覆盖断层，无法证明 0-30 分钟和中期连续推进。", questLevelBands);

for (const [id, item] of Object.entries(mechanics)) {
  gate(item.evidence > 0 && item.guidedByQuest, `p2.mechanic_guidance.${id}`, "high", `核心玩法缺少任务牵引：${id}。`, item);
}

const skillByClass = classes.map((classDef) => ({
  classId: classDef.id,
  className: classDef.name,
  active: countWhere(skills, (skill) => skill.classId === classDef.id && skill.type === "active"),
  passive: countWhere(skills, (skill) => skill.classId === classDef.id && skill.type === "passive")
}));
for (const row of skillByClass) {
  gate(row.active >= 10 && row.passive >= 4, `p2.skill_depth.${row.classId}`, "high", `${row.className} 技能树深度不足。`, { current: row, target: ">=10 active, >=4 passive" });
}

const sourceStats = {
  quests: confidenceStats(quests),
  classes: confidenceStats(classes),
  skills: confidenceStats(skills),
  equipment: confidenceStats(equipment),
  pets: confidenceStats(pets),
  maps: confidenceStats(maps),
  monsters: confidenceStats(monsters),
  monsterStats: confidenceStats(monsters, "stat_confidence")
};

gate(sourceStats.skills.strongRatio >= 0.8, "p2.source.skills", "high", "技能数据官方/强来源比例不足，不能说数值对齐。", sourceStats.skills);
gate(sourceStats.equipment.strongRatio >= 0.65, "p2.source.equipment", "medium", "装备数据溯源不足，装备养成对标不稳。", sourceStats.equipment);
gate(sourceStats.pets.strongRatio >= 0.65, "p2.source.pets", "medium", "宠物数据溯源不足，宠物养成对标不稳。", sourceStats.pets);
gate((sourceStats.monsterStats.official || 0) + (sourceStats.monsterStats.player_observed || 0) >= Math.ceil(monsters.length * 0.5), "p2.source.monster_stats", "medium", "怪物战斗数值多为推断，刷怪/副本节奏不可证明贴近原版。", sourceStats.monsterStats);

const report = {
  generatedAt: new Date().toISOString(),
  status: issues.some((item) => item.severity === "critical") ? "not_ready" : issues.length ? "risk" : "ready",
  summary: {
    quests: quests.length,
    chainCounts,
    objectiveCounts,
    questLevelBands,
    classes: classes.length,
    skills: skills.length,
    equipment: equipment.length,
    pets: pets.length,
    dungeons: dungeons.length,
    activities: activities.length,
    maps: maps.length,
    monsters: monsters.length
  },
  mechanics,
  skillByClass,
  sourceStats,
  issues
};

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "p2-readiness-audit.json"), JSON.stringify(report, null, 2));

const lines = [
  "# P2.0 Readiness Audit",
  "",
  `Status: ${report.status}`,
  `Generated: ${report.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Quests: ${quests.length}; chains: ${JSON.stringify(chainCounts)}.`,
  `- Objectives: ${JSON.stringify(objectiveCounts)}.`,
  `- Level bands: ${JSON.stringify(questLevelBands)}.`,
  `- Systems: classes ${classes.length}, skills ${skills.length}, equipment ${equipment.length}, pets ${pets.length}, dungeons ${dungeons.length}, activities ${activities.length}.`,
  "",
  "## Issues",
  "",
  ...issues.map((issue) => `- [${issue.severity}] ${issue.id}: ${issue.message} Evidence: ${JSON.stringify(issue.evidence)}`),
  "",
  "## Mechanic Guidance",
  "",
  ...Object.entries(mechanics).map(([id, item]) => `- ${id}: evidence=${item.evidence}, guidedByQuest=${item.guidedByQuest}`),
  ""
];
await writeFile(join(outDir, "p2-readiness-audit.md"), lines.join("\n"));

console.log(`P2.0 readiness: ${report.status}`);
console.log(`Issues: ${issues.length}`);
console.table(issues.reduce((acc, issue) => {
  acc[issue.severity] = (acc[issue.severity] || 0) + 1;
  return acc;
}, {}));

if (process.argv.includes("--strict") && report.status !== "ready") {
  process.exitCode = 1;
}
