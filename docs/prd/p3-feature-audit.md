# P3 完整对标资料审计

生成时间：2026-07-04 21:45 CST

审计范围只覆盖 `docs/prd/p1-p3-prd.md` 中 P3“完整对标版”。P3 是端游资料可考据内容的全量上限，因此本审计以 `docs/feature/feature.md` 的 95 个 feature 为逐项清单，并叠加 P3 明确新增的飞升、110级、后期地图/副本、幻神、法宝、灵、战魂、典籍卡、称号、装备祝福、龙翼秘宝、翅膀雕花、宠物法阵等要求。

状态口径：

- `sufficient`：已有本地资料能支撑数据本地化，包含核心规则、等级/限制、属性/数值、材料/产出、任务/地图/怪物或美术参考中的关键字段。
- `partial`：有官方或玩家百科证据，但缺全量数值、产出、材料、怪物/BOSS、任务链、图标/界面或 P3 全量枚举。
- `missing`：本地未找到可直接支撑 feature 的详细原版信息。
- `uncertain`：有线索或运营公告，但口径依赖版本、付费/多人活动、玩家整理或需要实机确认。

## 结论

| 指标 | 数量 |
| --- | ---: |
| 已审计 P3 feature | 95 |
| sufficient | 45 |
| partial | 38 |
| missing | 5 |
| uncertain | 7 |
| 本次新增官方来源 | 6 |

总体判断：P3 可以开始做“基础职业/装备/宠物/早中期地图任务/旧平行世界”的数据本地化；但 P3 真正的毕业体验，包括 110 级后期装备、幻神、战魂、灵、龙翼秘宝、宠物法阵、高阶副本材料循环，还不能直接进入全量数据落表。后期系统现在多为 FFO百科/BWIKI 和少量官方公告互证，必须补官方公告、实机截图或可复现的游戏内数据。

## 主要证据

- 官方旧资料中心：`docs/reference/markdown/official_deep/`，覆盖职业、装备道具、地图、NPC、怪物、任务、装备系统、宠物系统、平行世界、怪物猎杀令等 157 个旧资料页。
- 官方新闻/活动归档：`docs/reference/markdown/official/`，覆盖典籍卡、宠物法阵、觉醒、活动投放等官方公告。
- FFO百科：`docs/reference/markdown/ffobaike/`，覆盖 110级、典籍卡、称号、装备祝福、龙翼秘宝、翅膀雕花、宠物法阵、通天塔、珍珠海域等后期资料。
- 本次新增官方补充：`docs/reference/p3-official-supplement-index.md`。
- 图片索引：`docs/reference/image-index.csv`，现有 385 条图片引用、260 张本地参考图；图片仅作原创化参考。

## Feature 审计表

| 类别 | Feature | 状态 | 证据 | 缺口/备注 |
| --- | --- | --- | --- | --- |
| 基础体验 | 角色创建 | sufficient | official_deep/1_4, 7_1-7_7 | 足够支撑创建流程；P3 需另补后期外观原创化规范。 |
| 基础体验 | 五职业 | sufficient | official_deep/1_5, 3_2, 3_8* | 五职业定位、初行与技能资料齐；飞升/110新技能另计。 |
| 基础体验 | 转职/飞升 | partial | official_deep/1_5, 3_8_2, ffobaike lv110 | 转职有官方资料；飞升轮回、神恩、魂化的完整任务/消耗/属性未全。 |
| 基础体验 | 等级成长 | partial | official_deep/2_5*, ffobaike lv110, p3_official 18656583 | 1-100较足；101-110突破条件、奖励和经验曲线需结构化。 |
| 基础体验 | 属性点 | partial | official_deep/1_5, ffobaike lv110 | 职业成长方向有；完整属性换算、110突破奖励属性点需实机或表格。 |
| 基础体验 | 技能学习/加点 | partial | official_deep/3_2, 3_8*, p3_official 18656583 | 旧技能有；完整技能等级、消耗、CD、110新技能图片表需转录。 |
| 基础体验 | 自动寻路 | uncertain | PRD 单机化需求 | 端游原版偏操作/任务指引资料，自动寻路是单机化改造，需要自行设计。 |
| 基础体验 | 自动战斗 | uncertain | PRD 单机化需求 | 原版挂机/自动战斗口径不足；需定义单机 AI 策略。 |
| 基础体验 | 自动补给 | uncertain | official_deep 操作/道具资料 | 药品资料有，自动补给阈值不是原版明确信息。 |
| 基础体验 | 地图传送 | sufficient | ffobaike 时空传送, official_deep 地图/NPC | 传送网络和 NPC 线索可落表；后期地图入口另见地图项。 |
| 基础体验 | 任务指引 | sufficient | official_deep/2_5*, 7_* | 旧任务链有任务等级/NPC/地图/说明。 |
| 战斗刷怪 | 普通攻击 | sufficient | official_deep 职业/武器/怪物 | 基础战斗字段可推；精确公式需后续数值模型。 |
| 战斗刷怪 | 主动技能 | partial | official_deep/3_2, 3_8*, p3_official 18656583 | P3完整技能树和110新技能需全量转录。 |
| 战斗刷怪 | 被动技能 | partial | official_deep/3_2, 3_8* | 有技能资料但缺全部等级数值和飞升被动。 |
| 战斗刷怪 | 职业定位 | sufficient | official_deep/1_5, 3_2 | 五职业定位足够。 |
| 战斗刷怪 | 野外刷怪 | partial | official_deep/2_3, 2_4*, 2_5* | 地图/怪物/掉落有旧资料；后期刷点、刷新、权重不全。 |
| 战斗刷怪 | 精英怪 | partial | official_deep 怪物图鉴, ffobaike 活动页 | 有怪物/BOSS线索；精英刷新规则不全。 |
| 战斗刷怪 | BOSS战 | partial | official_deep/4_1, ffobaike 各副本活动 | 多数缺阶段机制、技能、狂暴、掉落权重。 |
| 战斗刷怪 | 单人副本 | partial | official_deep/4_1, ffobaike act pages | 原版多为组队/活动；单人化规则需设计，原始副本信息不全。 |
| 战斗刷怪 | 挂机刷怪 | uncertain | PRD 单机化需求 | 端游可借鉴刷怪循环，但挂机策略属改造。 |
| 战斗刷怪 | 死亡复活 | partial | official_deep 新手/操作资料 | 基础可用；复活惩罚、后期副本复活限制待实机。 |
| 地图任务 | 主城 | sufficient | official_deep/2_2*, 2_3*, 2_5* | 主城/NPC/任务资料足够。 |
| 地图任务 | 新手村 | sufficient | official_deep/7_2, 7_3, 2_5 | 桃源/长乐新手任务足够。 |
| 地图任务 | 野外地图 | partial | official_deep/2_2*, ffobaike/bwiki 后期目录 | 旧地图足；P3后期全地图怪物分布/产出不全。 |
| 地图任务 | NPC | sufficient | official_deep NPC介绍, 任务页 | NPC功能和任务关系可抽取。 |
| 地图任务 | 怪物图鉴 | sufficient | official_deep/2_4*, ffobaike 宠物/活动 | 旧怪物字段较足；后期怪物仍需补。 |
| 地图任务 | 主线任务 | partial | official_deep/2_5*, p3_official 80-100任务 | 1-100资料较足；80-110完整主线/新等级任务仍缺。 |
| 地图任务 | 支线任务 | sufficient | official_deep/2_5*, 7_* | 旧支线任务可结构化。 |
| 地图任务 | 职业任务 | sufficient | official_deep/2_5 职业任务 | 职业任务链有官方资料。 |
| 地图任务 | 收集任务 | sufficient | ffobaike 收集任务, official_deep/2_5 | 规则和循环口径可落表。 |
| 地图任务 | 循环任务 | sufficient | official_deep/7_5, ffobaike 活跃/收集 | 可重复任务资料足够。 |
| 地图任务 | 平行世界副本任务 | sufficient | official_deep/4_1, 2_5 平行世界 | 早中期平行世界入口和任务足够。 |
| 装备道具 | 基础装备 | sufficient | official_deep/2_1* | 装备分类、等级、属性较足。 |
| 装备道具 | 职业外套 | sufficient | official_deep/2_1, 千幻/变装页 | 职业限定和外观参考可用。 |
| 装备道具 | 武器 | sufficient | official_deep/2_1_4 等 | 武器等级/属性表较足。 |
| 装备道具 | 防具 | sufficient | official_deep/2_1_5 等 | 防具基础属性可抽。 |
| 装备道具 | 饰品 | sufficient | official_deep/2_1_6 等 | 饰品基础属性可抽。 |
| 装备道具 | 套装 | partial | official_deep/2_1_2, ffobaike 套装技能 | 旧套装可用；高阶套装/102/108套装图谱缺全量。 |
| 装备道具 | 外甲 | partial | official_deep/2_1_3, 千幻/变装页 | 旧外甲可用；高阶外观/属性与图标不全。 |
| 装备道具 | 收集品 | sufficient | official_deep/2_1, 2_4* | 怪物掉落收集品可抽。 |
| 装备道具 | 消耗品 | sufficient | official_deep/2_1_7 | 消耗品分类与部分效果可用。 |
| 装备道具 | 卡片 | partial | official_deep/2_1_8, 3_1, official 典籍卡 | 基础卡片镶嵌有；高阶卡片/典籍卡分开补。 |
| 装备道具 | 装备耐久/修理 | sufficient | official_deep/2_1 | 规则明确。 |
| 装备道具 | 装备加工 | sufficient | official_deep/3_1_1, ffobaike 后期装备页 | 旧加工流程可落；高阶概率另补。 |
| 装备道具 | 打孔镶嵌 | sufficient | official_deep/3_1_2, 3_1_3 | 规则可落表。 |
| 装备道具 | 装备升级 | partial | official_deep/3_1_4, ffobaike lv110, p3_official 18656583 | 旧升级有；102/108升级消耗“不一一列举”，需实机。 |
| 装备道具 | 拆解 | sufficient | official_deep/3_1_5 | 基础拆解规则可用。 |
| 装备道具 | 附魂 | partial | official_deep/3_1_6, ffobaike 装备觉醒/龙翼 | 基础附魂有；高阶附魂池和神兵碎片待补。 |
| 装备道具 | 装备基础属性 | sufficient | official_deep/2_1, 3_1_6 | 基础属性说明可用。 |
| 宠物系统 | 宠物捕捉 | sufficient | official_deep/3_3, ffobaike 宠物图鉴 | 捕捉工具、等级、名誉要求明确。 |
| 宠物系统 | 喂养 | sufficient | official_deep/3_3_1 | 规则可用。 |
| 宠物系统 | 召唤 | sufficient | official_deep/3_3_2 | 规则可用。 |
| 宠物系统 | 信赖度 | sufficient | official_deep/3_3_3 | 规则可用。 |
| 宠物系统 | 宠物技能 | partial | official_deep/3_3_4, ffobaike 宠物图鉴 | 技能体系有；全量技能池/概率/毕业组合不全。 |
| 宠物系统 | 命名 | sufficient | official_deep/3_3_5 | 规则可用。 |
| 宠物系统 | 幻化 | partial | official_deep/3_3_6 | 旧幻化有；P3全量宠物幻化素材/图标不全。 |
| 宠物系统 | 宠物技能丸 | partial | official_deep/3_3_8 | 有系统页；全量丸子、产出和概率不全。 |
| 宠物系统 | 宠物培育 | partial | official_deep/3_3_9 | 有系统页；成长结果和材料需结构化。 |
| 宠物系统 | 宠物经验 | partial | official_deep/3_3, p3_official 颠倒魔塔 | 基础等级限制有；经验曲线和幻神经验交叉需补。 |
| 宠物系统 | 宠物成长类型 | partial | official_deep/3_3, ffobaike 宠物图鉴 | 图鉴有成长字段；需全量导出。 |
| 宠物系统 | 宠物装备 | partial | P2/P3 PRD, official/ffobaike 零散 | 缺全量装备、进阶、产出、图标。 |
| 宠物系统 | 宠物法阵 | partial | ffobaike 宠物法阵, official 宠物法阵公告, p3_official 18713379 | 规则/属性较多；六爻、全属性、产出和数值需实机校验。 |
| 副本活动 | 赤枭巢穴 | sufficient | official_deep/4_1 | 等级、入口、任务道具足够，BOSS细节仍可后补。 |
| 副本活动 | 八仙结界 | sufficient | official_deep/4_1 | 等级、入口、职业道具足够。 |
| 副本活动 | 纯阳宝塔 | sufficient | official_deep/4_1 | 入口/任务足够。 |
| 副本活动 | 塔狱 | sufficient | official_deep/4_1 | 入口/任务足够。 |
| 副本活动 | 天空之泉 | sufficient | official_deep/4_1 | 入口/任务足够。 |
| 副本活动 | 天之眼 | sufficient | official_deep/4_1 | 入口/任务足够。 |
| 副本活动 | 失落神殿 | sufficient | official_deep/4_1 | 入口/任务足够。 |
| 副本活动 | 花妖巢穴 | sufficient | official_deep/4_1 | 入口/任务足够。 |
| 副本活动 | 夜影村 | missing | 未在本地归档找到详细页 | 缺入口、地图、怪物/BOSS、任务、掉落、美术。 |
| 副本活动 | 迷雾沼泽 | partial | bwiki目录, p3_official 颠倒魔塔钥匙 | 仅有钥匙/目录线索；缺副本机制、地图、BOSS、掉落。 |
| 副本活动 | 冰火双螺 | partial | bwiki目录, p3_official 颠倒魔塔钥匙 | 同上，缺机制和产出。 |
| 副本活动 | 灵泽殿 | partial | p3_official 80-100任务, 颠倒魔塔钥匙 | 有任务/BOSS名“蛟龙神”线索；缺副本全量数据。 |
| 副本活动 | 先祖山 | partial | p3_official 颠倒魔塔钥匙, bwiki目录 | 有钥匙线索；缺地图、BOSS、掉落、任务。 |
| 副本活动 | 八仙东海战 | missing | bwiki目录线索不足 | 缺详细官方/百科页。 |
| 副本活动 | 妖皇府 | missing | bwiki目录线索不足 | 缺入口、怪物/BOSS、产出。 |
| 副本活动 | 昆仑雪 | missing | bwiki目录线索不足 | 缺入口、怪物/BOSS、产出。 |
| 副本活动 | 通天魔劫塔 | missing | ffobaike/bwiki导航线索 | 缺规则、层数、BOSS、奖励。 |
| 单机日常 | 试炼 | sufficient | ffobaike 试炼, official_deep 法宝任务 | 规则/奖励线索足够。 |
| 单机日常 | 珍珠海域 | sufficient | ffobaike 珍珠海域, 云荒无极域 | 规则和图文参考足够。 |
| 单机日常 | 保卫战 | sufficient | ffobaike 保卫战 | 活动规则足够。 |
| 单机日常 | 天魔劫 | sufficient | ffobaike 天魔劫 | 活动规则足够。 |
| 单机日常 | 通天塔 | partial | ffobaike 通天塔, official_deep 任务 | 旧通天塔有；P3高层/高阶奖励和材料循环不全。 |
| 单机日常 | 怪物猎杀令 | sufficient | ffobaike 怪物猎杀令, official_deep/4_3 | 规则可落表。 |
| 后期养成 | 幻神 | uncertain | p3_official 颠倒魔塔 | 官方仅确认幻神经验/法器产出；缺解锁、升级、技能、属性全量。 |
| 后期养成 | 法宝 | partial | official_deep/2_5_21-23, p3_official 法宝页 | 一至四阶和周年法宝有；P3全量法宝、加工、附魂、秘/真系列材料需补。 |
| 后期养成 | 灵 | uncertain | ffobaike 黄金灵与霸者无双, p3_official 霸者无双 | 有黄金灵/戒灵等组合线索；“灵”系统边界、等级、材料、上限不清。 |
| 后期养成 | 战魂 | uncertain | p3_official 18713379 | 仅有战魂远征补给包线索；缺系统规则、槽位、品质、升级。 |
| 后期养成 | 典籍卡 | partial | ffobaike 典籍卡, official 典籍卡公告 | 54张卡、属性、升星升阶较全；产出概率和活动来源需补。 |
| 后期养成 | 称号 | partial | ffobaike 称号, p3_official 称号石/颠倒魔塔 | 属性称号有；全量达成条件、时效、属性需补。 |
| 后期养成 | 110级新等级 | partial | ffobaike lv110, p3_official 18656583 | 官方确认110与突破；缺完整条件表、奖励表、经验曲线、102/108装备消耗。 |
| 后期养成 | 装备祝福 | partial | ffobaike 装备祝福 | 规则/材料/星级表较多；成功率和部位完整公式需实机校验。 |
| 后期养成 | 龙翼秘宝 | partial | ffobaike 龙翼秘宝, p3_official 18713379 | 合成/加工/强化有；被移除BOSS产出、强化概率和高阶材料需确认。 |
| 后期养成 | 翅膀雕花 | partial | ffobaike 翅膀雕花, p3_official 18656583 | 规则/材料/属性表较全；五彩绢丝来源和全翅膀图标需补。 |

## 可进入数据本地化的部分

- `classes.json`、`skills.json` 的基础职业与早中期技能，但 110 新技能先标 `source_confidence=official_image_pending_transcription`。
- `maps.json`、`npcs.json`、`quests.json` 的 1-100 旧资料中心地图/NPC/任务。
- `equipment.json`、`items.json`、`enhancement_rules.json` 的旧装备、耐久、加工、打孔、镶嵌、拆解、基础附魂。
- `pets.json`、`pet_skills.json` 的旧宠物捕捉/喂养/召唤/信赖/命名基础规则。
- `dungeons.json` 的 8 个旧平行世界入口/等级/任务关系。
- `activities.json` 的试炼、珍珠海域、保卫战、天魔劫、怪物猎杀令基础规则。

## 暂不建议直接落全量数据的部分

- P3 高阶副本：夜影村、迷雾沼泽、冰火双螺、灵泽殿、先祖山、八仙东海战、妖皇府、昆仑雪、通天魔劫塔。
- 后期养成：幻神、灵、战魂、110级突破奖励、102/108装备升级材料、宠物法阵六爻/全属性、龙翼秘宝强化概率。
- 全量美术参考：高阶副本场景、BOSS、幻神/法宝/灵/战魂图标、后期装备/翅膀/龙翼外观。
