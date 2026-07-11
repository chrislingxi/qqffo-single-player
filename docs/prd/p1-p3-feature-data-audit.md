# P1-P3 Feature 本地数据审计

生成时间：2026-07-04 22:00 CST

## 结论

本地现在没有覆盖 P1-P3 全部开发 feature 的“全面可开发数据”。更准确地说：

- 原始资料层：覆盖较好，官方旧资料中心、FFO百科、BWIKI、官方公告已经能支撑大量规则拆解。
- 结构化数据层：只存在 P1 原型级 `data/design/*.json`，且多数 `source_confidence=inferred`，不是源字段完备的端游数据。
- P2/P3 数据表：PRD 要求的多数表还没落地，例如 `class_advancement.json`、`skill_trees.json`、`activities.json`、`late_growth.json`、`endgame_dungeons.json`、`full_equipment_catalog.json` 等。

因此，当前不能直接进入 P1-P3 全量开发；可以先进入 P1 数据清洗/落表阶段，P2/P3 必须继续补结构化数据和实机验证。

## 审计口径

| 字段 | 说明 |
| --- | --- |
| 版本 | 该 feature 首次进入开发范围的版本；后续版本默认继承并扩充。 |
| 原始资料 | `sufficient` 表示已有公开资料可支撑规则拆解；`partial` 表示有资料但缺字段；`missing` 表示未找到详细资料；`uncertain` 表示更多是单机化改造或口径需实机。 |
| 结构化数据 | `ready` 表示已有源字段较完整的本地 JSON；`partial` 表示只有样例/推断/未覆盖全量；`missing` 表示尚无可开发数据表。 |

## 总览

| 指标 | 数量 |
| --- | ---: |
| 已审计 feature | 95 |
| 原始资料 sufficient | 50 |
| 原始资料 partial | 35 |
| 原始资料 uncertain | 6 |
| 原始资料 missing | 4 |
| 结构化数据 ready | 0 |
| 结构化数据 partial | 38 |
| 结构化数据 missing | 57 |

| 范围 | feature数 | 原始资料判断 | 结构化数据判断 |
| --- | ---: | --- | --- |
| P1 首发核心 | 46 | 多数 sufficient/partial；自动系统为 uncertain | 全部最多 partial；没有 fully ready |
| P2 新增/扩展 | 31 | 中期官方资料较足，装备/宠物/日常多为 partial | 基本 missing，仅宠物有 structured reference，未进入 `data/design` |
| P3 新增/完整对标 | 18 | 后期系统多为 partial/uncertain，高阶副本有 missing | 基本 missing |

## 已有结构化数据体量

| 文件 | 现状 | 判断 |
| --- | --- | --- |
| `data/design/classes.json` | 5职业，字段为单机化推断 | P1 partial |
| `data/design/skills.json` | 20个 P1 样例技能 | P1 partial |
| `data/design/levels.json` | 1-35 推断曲线 | P1 partial |
| `data/design/maps.json` | 8张样例地图/副本 | P1 partial，非原版全量 |
| `data/design/monsters.json` | 13个样例怪/BOSS | P1 partial，非原版全量 |
| `data/design/quests.json` | 20条样例任务 | P1 partial，非原版任务链 |
| `data/design/equipment.json` | 12件样例装备 | P1 partial，非原版装备表 |
| `data/design/pets.json` | 6只样例宠物 | P1 partial，未接入 378 宠物图鉴 |
| `docs/reference/structured/pet_catalog_ffobaike.json` | 378 宠物详情 | reference ready，但未转成 `data/design/full_pet_catalog.json` |
| `docs/reference/structured/pet_level_exp_ffobaike.json` | 1-80 宠物经验 | reference ready |
| `docs/reference/structured/pet_skills_bwiki.json` | 24个宠物技能 | reference partial，非官方 |

## Feature 明细

| 版本 | 类别 | Feature | 原始资料 | 结构化数据 | 缺口 |
| --- | --- | --- | --- | --- | --- |
| P1 | 基础体验 | 角色创建 | sufficient | missing | 缺角色创建配置、初始外观/出生点/默认物品表。 |
| P1 | 基础体验 | 五职业 | sufficient | partial | 已有5职业样例，但成长系数为推断，需从官方职业资料清洗。 |
| P2/P3 | 基础体验 | 转职/飞升 | partial | missing | 转职资料有；飞升、神恩、魂化、轮回未结构化。 |
| P1/P3 | 基础体验 | 等级成长 | partial | partial | P1 1-35曲线为推断；80突破和101-110缺完整条件/经验表。 |
| P1 | 基础体验 | 属性点 | partial | partial | 缺端游属性到战斗属性换算与职业成长实数。 |
| P1/P3 | 基础体验 | 技能学习/加点 | partial | partial | P1技能是样例；完整技能树、转职/飞升/110新技能未落表。 |
| P1 | 基础体验 | 自动寻路 | uncertain | missing | 属单机化改造；缺地图节点、寻路点、任务目标坐标。 |
| P1 | 基础体验 | 自动战斗 | uncertain | missing | 属单机化改造；缺技能优先级、血蓝阈值、目标选择策略。 |
| P1 | 基础体验 | 自动补给 | uncertain | missing | 药品有资料，自动补给规则需自定并落表。 |
| P1 | 基础体验 | 地图传送 | sufficient | partial | maps 有连接样例；缺原版传送NPC、费用、条件全表。 |
| P1 | 基础体验 | 任务指引 | sufficient | partial | quests 为样例；缺原版任务坐标/自动指引字段。 |
| P1 | 战斗刷怪 | 普通攻击 | partial | partial | 公式为推断；缺职业攻速、命中/闪避/暴击官方公式。 |
| P1/P3 | 战斗刷怪 | 主动技能 | partial | partial | 20个样例；缺每职业完整技能等级/消耗/CD/距离。 |
| P1/P3 | 战斗刷怪 | 被动技能 | partial | partial | 样例很少；缺完整被动和飞升/高阶被动。 |
| P1 | 战斗刷怪 | 职业定位 | sufficient | partial | 定位资料够，数值仍为推断。 |
| P1/P2/P3 | 战斗刷怪 | 野外刷怪 | partial | partial | spawns 为样例；缺原版刷点、刷新时间、地图怪物分布。 |
| P1/P2/P3 | 战斗刷怪 | 精英怪 | partial | partial | 样例精英3个；缺原版精英刷新、掉落、巡逻/技能。 |
| P1/P2/P3 | 战斗刷怪 | BOSS战 | partial | partial | 样例BOSS2个；缺阶段技能、机制、掉落权重。 |
| P1/P2/P3 | 战斗刷怪 | 单人副本 | partial | partial | P1副本为原创样例；端游副本多为组队，单机化配置未定。 |
| P1/P2/P3 | 战斗刷怪 | 挂机刷怪 | uncertain | missing | 属单机化策略；缺挂机配置表。 |
| P1 | 战斗刷怪 | 死亡复活 | partial | missing | 缺复活点、惩罚、道具、自动复活规则。 |
| P1 | 地图任务 | 主城 | sufficient | partial | 龙城样例有；缺主城全NPC、坐标、功能、商店。 |
| P1 | 地图任务 | 新手村 | sufficient | partial | 桃源村样例有；缺桃源/长乐完整NPC和任务坐标。 |
| P1/P2/P3 | 地图任务 | 野外地图 | partial | partial | 只有少量样例地图；P2/P3地图全量未结构化。 |
| P1/P2/P3 | 地图任务 | NPC | sufficient | partial | 8个样例NPC；官方NPC资料未全量落表。 |
| P1/P2/P3 | 地图任务 | 怪物图鉴 | sufficient | partial | 官方怪物图鉴有；`monsters.json` 只有13个样例。 |
| P1/P2/P3 | 地图任务 | 主线任务 | partial | partial | 20条样例；缺原版1-110主线/世界任务全链。 |
| P1/P2 | 地图任务 | 支线任务 | sufficient | partial | 官方任务资料有；未全量抽取到 `quests.json`。 |
| P2 | 地图任务 | 职业任务 | sufficient | missing | 官方资料有；缺 `class_advancement.json`/职业任务链表。 |
| P1/P2 | 地图任务 | 收集任务 | sufficient | partial | 规则有；缺按地图/等级分层表。 |
| P1/P2 | 地图任务 | 循环任务 | sufficient | partial | 样例1条；缺全等级循环任务表。 |
| P2 | 地图任务 | 平行世界副本任务 | sufficient | missing | 官方入口/任务有；缺副本任务链结构化。 |
| P1 | 装备道具 | 基础装备 | sufficient | partial | `equipment.json` 只有12件样例。 |
| P2 | 装备道具 | 职业外套 | sufficient | partial | 有资料和样例外观线索；缺全职业/等级/属性表。 |
| P1/P2/P3 | 装备道具 | 武器 | sufficient | partial | 官方武器资料有；未全量落表。 |
| P1/P2/P3 | 装备道具 | 防具 | sufficient | partial | 官方防具资料有；未全量落表。 |
| P1/P2/P3 | 装备道具 | 饰品 | sufficient | partial | 官方饰品资料有；未全量落表。 |
| P2/P3 | 装备道具 | 套装 | partial | missing | 套装/套装技能资料有；缺 `equipment_sets.json`。 |
| P2/P3 | 装备道具 | 外甲 | partial | missing | 资料有；缺外甲/千幻/变装结构化。 |
| P1 | 装备道具 | 收集品 | sufficient | partial | items 只有少量样例；官方掉落收集品未全量落表。 |
| P1 | 装备道具 | 消耗品 | sufficient | partial | items 只有药品/样例；商城/活动消耗品未全量落表。 |
| P2/P3 | 装备道具 | 卡片 | sufficient | missing | 新增官方卡片页；缺 `cards.json`、卡片等级/属性/来源/合成概率表。 |
| P1 | 装备道具 | 装备耐久/修理 | sufficient | partial | 规则有；缺修理费用、耐久损耗参数表。 |
| P2/P3 | 装备道具 | 装备加工 | sufficient | missing | 规则有；缺加工等级、成功率、保护级、材料表。 |
| P2/P3 | 装备道具 | 打孔镶嵌 | sufficient | missing | 规则有；缺孔位、材料、概率、限制表。 |
| P2/P3 | 装备道具 | 装备升级 | partial | missing | 旧升级有；102/108官方明确“游戏里查看”，缺材料全表。 |
| P2/P3 | 装备道具 | 拆解 | sufficient | missing | 规则有；缺拆解返还和卡片拆解表。 |
| P2/P3 | 装备道具 | 附魂 | partial | missing | 基础资料有；高阶附魂池和材料缺。 |
| P1/P2/P3 | 装备道具 | 装备基础属性 | sufficient | partial | 官方装备属性有；未全量抽取到 JSON。 |
| P1 | 宠物系统 | 宠物捕捉 | sufficient | partial | 官方捕捉表18只、FFO图鉴378只；`pets.json` 仅6只样例。 |
| P1 | 宠物系统 | 喂养 | sufficient | partial | 新增官方喂养页；缺饥渴/休克/道具数值表。 |
| P1 | 宠物系统 | 召唤 | sufficient | partial | 官方资料有；缺召唤限制/战斗参数表。 |
| P2 | 宠物系统 | 信赖度 | sufficient | missing | 规则有；缺信赖变化、道具、效果参数。 |
| P2/P3 | 宠物系统 | 宠物技能 | sufficient | partial | 新增官方宠物技能页、BWIKI 24技能；未接入 `pet_skills.json`。 |
| P1 | 宠物系统 | 命名 | sufficient | missing | 规则有；缺命名限制/改名道具配置。 |
| P2/P3 | 宠物系统 | 幻化 | partial | missing | 有系统资料；缺幻化来源、外观、材料。 |
| P2/P3 | 宠物系统 | 宠物技能丸 | sufficient | missing | 新增官方页确认技能丸；缺丸子列表、概率、来源。 |
| P2/P3 | 宠物系统 | 宠物培育 | partial | missing | 有资料；缺培育公式、材料、结果范围。 |
| P1/P3 | 宠物系统 | 宠物经验 | sufficient | partial | 宠物1-80经验已结构化；未进入 `data/design`。 |
| P1/P3 | 宠物系统 | 宠物成长类型 | sufficient | partial | 图鉴有；未转成 `full_pet_catalog.json`。 |
| P2/P3 | 宠物系统 | 宠物装备 | sufficient | missing | 新增官方宠物装备/刻印页；缺装备全表、刻印/觉醒材料。 |
| P3 | 宠物系统 | 宠物法阵 | partial | missing | 有百科和官方公告线索；缺六爻、全属性、加持数值实测。 |
| P2 | 副本活动 | 赤枭巢穴 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 八仙结界 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 纯阳宝塔 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 塔狱 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 天空之泉 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 天之眼 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 失落神殿 | sufficient | missing | 官方入口资料有；缺地图、波次、BOSS、掉落表。 |
| P2 | 副本活动 | 花妖巢穴 | sufficient | missing | 官方入口资料有；新增卡片页补掉落线索；仍缺完整掉落权重。 |
| P3 | 副本活动 | 夜影村 | partial | missing | 新增卡片页证明惊悚夜影村掉落卡片；缺副本完整数据。 |
| P3 | 副本活动 | 迷雾沼泽 | partial | missing | 颠倒魔塔页有钥匙线索；缺副本完整数据。 |
| P3 | 副本活动 | 冰火双螺 | partial | missing | 颠倒魔塔页有钥匙线索；缺副本完整数据。 |
| P3 | 副本活动 | 灵泽殿 | partial | missing | 80-100任务和钥匙线索有；缺副本完整数据。 |
| P3 | 副本活动 | 先祖山 | partial | missing | 颠倒魔塔页有钥匙线索；缺副本完整数据。 |
| P3 | 副本活动 | 八仙东海战 | missing | missing | 仅目录线索，缺官方/百科详细页。 |
| P3 | 副本活动 | 妖皇府 | missing | missing | 仅目录线索，缺官方/百科详细页。 |
| P3 | 副本活动 | 昆仑雪 | missing | missing | 仅目录线索，缺官方/百科详细页。 |
| P3 | 副本活动 | 通天魔劫塔 | missing | missing | 仅导航线索，缺规则、层数、BOSS、奖励。 |
| P2 | 单机日常 | 试炼 | sufficient | missing | FFO百科规则有；缺 `activities.json`。 |
| P2 | 单机日常 | 珍珠海域 | sufficient | missing | FFO百科规则/图片有；缺 `activities.json`。 |
| P2 | 单机日常 | 保卫战 | sufficient | missing | FFO百科规则有；缺 `activities.json`。 |
| P2 | 单机日常 | 天魔劫 | sufficient | missing | FFO百科规则有；缺 `activities.json`。 |
| P2/P3 | 单机日常 | 通天塔 | partial | missing | 旧资料有；高层和奖励缺，未落 `tower_layers.json`。 |
| P2/P3 | 单机日常 | 怪物猎杀令 | sufficient | missing | 规则有；缺等级段目标和奖励表。 |
| P3 | 后期养成 | 幻神 | partial | missing | 官方活动确认幻神法器/经验；缺系统规则、技能、经验。 |
| P3 | 后期养成 | 法宝 | partial | missing | 官方法宝任务/周年页有；缺全量法宝、材料、加工附魂。 |
| P3 | 后期养成 | 灵 | uncertain | missing | 黄金灵/霸者无双线索有；系统边界和升级材料不清。 |
| P3 | 后期养成 | 战魂 | uncertain | missing | 官方仅提战魂远征补给包；缺系统数据。 |
| P3 | 后期养成 | 典籍卡 | partial | missing | FFO百科和官方公告有；缺 `codex_cards.json` 和产出概率。 |
| P3 | 后期养成 | 称号 | partial | missing | 称号资料有；缺全量达成条件/属性/时效。 |
| P3 | 后期养成 | 110级新等级 | partial | missing | 官方确认突破和102/108装备；缺完整条件、奖励、经验、装备消耗。 |
| P3 | 后期养成 | 装备祝福 | partial | missing | FFO百科资料有；缺成功率、部位公式、材料来源全表。 |
| P3 | 后期养成 | 龙翼秘宝 | partial | missing | FFO百科和公告有；缺强化概率、替代产出、材料全表。 |
| P3 | 后期养成 | 翅膀雕花 | partial | missing | FFO百科资料较多；缺材料来源和全翅膀对应图标。 |

## 已补查并新增的官方资料

本轮新增 8 个官方公开页，见 `docs/reference/p1p3-official-supplement-index.md`。主要补强：

- P1/P2 宠物捕捉、喂养、技能、技能丸、资质鉴定、宠物装备。
- P2 卡片获取、镶嵌、合成、拆解规则。
- P3 102/108装备与等级突破抢先体验服公告。
- P3 夜影村至少有“卡片掉落”官方线索，但不是完整副本资料。

## 下一步建议

1. 先做 P1 数据清洗：把官方旧资料中心的职业、1-35地图、NPC、怪物、任务、装备、宠物捕捉资料转成 source-backed JSON，替换当前 inferred 样例。
2. 再做 P2 表：`class_advancement.json`、`skill_trees.json`、`equipment_sets.json`、`cards.json`、`enhancement_rules.json`、`pet_skills.json`、`pet_equipment.json`、`activities.json`、`tower_layers.json`。
3. P3 暂不直接开发数据，先补实机或官方资料：110突破、102/108装备、高阶副本、幻神、战魂、灵、宠物法阵、龙翼秘宝。
