# P3 多 Agent 本地化与试玩审计记录 Loop 03

更新时间：2026-07-05

## 本轮目标

继续推进 P3 完整对标，但把“资料目录”和“可运行玩法”硬隔离：全量宠物、本地副本图片、BOSS 名称可以先进入本地化目录；没有原始资料支撑的捕捉点、资质、技能绑定、BOSS 数值不能伪造成可玩内容。

## 多 Agent 结论

宠物资料：
- `full_pet_catalog.json` 是 378 只宠物目录身份表，不是运行表。
- 运行侧目前仍只应使用 `pets.json` 的 5 只可捕捉宠物。
- `uid/name/desc/apng_count/traits` 可安全落图鉴；`catchFrom/levelReq/growthType/base/skill` 不得从名字或描述推断。
- 目录宠必须显式 `runtime_enabled:false`，防止误进入出战、捕捉、战斗。

高阶副本：
- `endgame_dungeons.json` 的旧 `bosses/drops` 混有奖励名、页面噪声和机制说明，不能直接喂 UI 或战斗。
- BOSS/怪物优先从本地图片目录 `docs/reference/assets/entity_localized/dungeon_boss_or_monster` 抽取。
- 灵泽殿、昆仑雪、通天魔劫塔存在本地图片缺口，必须保留 `gaps`，不能假装完整。

运行体验：
- 378 宠物不能一次性塞入 `state.pets` 或图片 manifest，否则会拖慢首屏和存档。
- 9 个高阶副本不能直接走当前 `enterDungeon`，因为现有副本引擎要求 waves/rewards。
- 高阶资料应先作为后期目录/目标展示，后续再生成 `runtimeEndgameDungeons`。

## 本轮直接修复

- 新增 `tools/build_pet_runtime_catalog.mjs`，生成 `data/design/pet_runtime_catalog.json`：
  - 378 只宠物全量保留。
  - 保留 `catalog_uid/original_id/original_name/catalog_desc/reference_apng_count/traits/catalog_role/unlock_source`。
  - 全部标记 `runtime_enabled:false`、`gameplay_status:catalog_only`。
  - 删除上一版占位 `base_runtime_stats/growth_type`，不再伪造战斗属性。
- 新增 `tools/build_endgame_bosses.mjs`，生成 `data/design/endgame_bosses.json`：
  - 9 个高阶副本。
  - 59 个 BOSS/怪物/流程对象。
  - BOSS 名称优先来自本地图片文件名，过滤图谱、碎片、宝石、魂、幻化书、宝盒、场景图等奖励/页面噪声。
  - 每个 BOSS 附 `single_player_rules` 和未补齐的数值/技能/掉落权重缺口。
- 前端 `src/app.js`：
  - 加载 `petRuntimeCatalog/endgameBosses`。
  - 旧存档迁移时过滤非运行宠物，避免目录宠导致战斗崩溃。
  - `currentMap()` 加安全兜底，防止脏地图 id 打崩画布。
  - 宠物页新增“全宠物图鉴”摘要，但不提供捕捉/出战入口。
  - 后期页展示全宠物图鉴数、高阶 BOSS/对象数，并展示全部 9 个高阶副本。
- PWA 缓存新增 `pet_runtime_catalog.json/endgame_bosses.json`。

## 验收记录

- `node --check src/app.js`：通过。
- `node --check tools/build_single_player_runtime_data.mjs`：通过。
- `node --check tools/build_pet_runtime_catalog.mjs`：通过。
- `node --check tools/build_endgame_bosses.mjs`：通过。
- `npm run test:smoke`：通过，新增 378 图鉴、目录宠禁运行、BOSS 噪声过滤断言。
- `npm run test:player`：通过，五职业均可模拟到 55 级、4 副本、1 只真实运行宠；目录宠不会进入战斗属性计算。
- `npm run test:browser`：通过，覆盖横屏 PWA、面板滚动、战斗不中断、宠物图鉴展示、后期 BOSS 目录加载。
- 截图：`test-results/p3-mobile-smoke.png`。

## 仍需补齐

1. 宠物捕捉点、食性、资质成长、专属技能池仍缺原始结构化资料。
2. 9 个高阶副本已有 BOSS/对象目录，但缺血量、攻击、防御、技能时间轴、掉落权重。
3. 灵泽殿缺本地图片目录；昆仑雪与通天魔劫塔图片资料不完整。
4. 高阶副本还没有生成可进入的 `runtimeEndgameDungeons`，不能直接作为可玩副本上线。
5. 资产侧仍需把本地原图批量 AI 二创 Q 版化，当前只完成少量核心运行美术。

## Loop 04 优先级

1. P0：生成 `runtimeEndgameDungeons`，把 9 个高阶副本转成单人可打的入口、波次、BOSS 阶段和结算。
2. P0：为 59 个 BOSS/对象建立单机数值模板，所有推断字段标 `single_player_balance`。
3. P1：宠物图鉴做分页/搜索/懒加载，避免未来 378 张图影响首屏。
4. P1：按本地原图批量生成角色、怪物、BOSS、地图 Q 版资产，并接入 manifest。
