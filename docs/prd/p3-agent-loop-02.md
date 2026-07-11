# P3 多 Agent 本地化与试玩审计记录 Loop 02

更新时间：2026-07-05

## 本轮目标

继续向 P3 完整对标推进，重点处理 Loop 01 遗留的运行数据污染风险：本地资料中的多人、交易、排行等原文必须保留为考据资料，但不能进入单机运行层或 UI 展示。

## 多 Agent 结论

运行数据安全：
- raw 与 runtime 的分离方向成立，但第一版清洗不够硬。
- `display_rewards` 不能只过滤多人/交易词，还要过滤“官网、上一页、背景故事、怪物特性、适合某职业”等页面噪声。
- 测试应覆盖 dungeon、material、activity 三类 runtime 字段。

玩法资料落表：
- Loop 03 应优先做两件 P0：378 宠物运行化、9 个高阶副本机制/掉落正规化。
- 宠物源最完整，适合先从 `full_pet_catalog.json` 扩到运行表。
- 高阶副本当前仍有 rewards/bosses 混杂，建议新增 `endgame_bosses.json` 并拆 `entry/level/frequency/bosses/mechanics/reward_groups/single_player_rules/gaps`。

体验与美术：
- 抽屉小面板方向成立，但切 Tab 保留滚动位置、按钮换行、后期页太像审计表。
- 战斗反馈已有血条/飘字/日志，但缺命中闪白、抖动、击杀爆点、掉落光柱。
- 商业级短板仍是资产：alias 怪物、单帧角色、单地图背景、缺技能 VFX。

## 本轮直接修复

- 新增 `tools/build_single_player_runtime_data.mjs`，把资料原文与单机运行字段分离。
- `endgame_dungeons.json` 新增 `single_player_runtime`：
  - `entry_mode=solo`
  - `party_requirement=none`
  - `frequency_rule`
  - `frequency_display`
  - `display_bosses`
  - `display_rewards`
- `endgame_materials.json` 新增 `runtime_materials`，只保留运行安全材料名。
- `full_activity_catalog.json` 新增 `single_player_runtime`，剔除多人/排行/交易运行依赖。
- 前端后期页只读 runtime 字段，不再读 raw drops。
- 后期页改成玩家视角：先展示通天魔劫塔、龙翼秘宝、典籍卡、翅膀雕花四个目标，资料缺口折叠到二级。
- 抽屉切 Tab 自动回到顶部。
- 面板按钮强制不换行，避免“进入”拆行。
- 战斗反馈增强：敌人命中闪白/抖动、玩家受击闪白/抖动、击杀光圈、掉落光柱、技能/宠物冲击弧。

## 验收记录

- `node --check src/app.js`：通过。
- `node --check tools/build_single_player_runtime_data.mjs`：通过。
- `npm run test:smoke`：通过，新增 runtime 禁词和页面噪声断言。
- `npm run test:player`：通过，五职业均可模拟到 55 级、13 任务、4 副本、1 宠物。
- `npm run test:browser`：通过，覆盖横屏 PWA、抽屉不中线遮挡、Tab 切换归顶、runtime 数据加载后无多人/交易/排行词、战斗反馈可见。
- 截图：`test-results/p3-mobile-smoke.png`。

## Loop 03 优先级

1. P0：378 宠物从资料目录进入运行表，`pets.json` 不再只接少量样例。
2. P0：9 个 P3 高阶副本正规化，拆出 `endgame_bosses.json` 和运行级奖励组。
3. P1：宠物法阵和宠物装备单独成表。
4. P1：五职业技能树扩容，MP/CD/距离缺官方证据时继续标 `single_player_balance`。
5. P2：装备全量和后期系统展开；幻神、战魂仍先保留缺口，不主攻。
