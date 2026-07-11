# P3 多 Agent 本地化与试玩审计记录 Loop 04

更新时间：2026-07-05

## 本轮目标

把 Loop03 的 9 个高阶副本/59 个 BOSS 对象，从资料目录推进到当前单机副本引擎可运行的“单机试炼”适配层，同时保持透明：所有本地数值都标本地平衡，不冒充官方完整数值。

## 多 Agent 结论

- 当前副本引擎只认 `data.dungeons`：最小字段为 `id/name/levelReq/entryMap/waves/rewards`。
- 运行怪物最小字段为 `id/name/type/level/hp/attack/defense/exp`。
- 如果副本 id 会写入 `state.mapId`，应同步提供 map 记录，避免画面回退误导。
- 奖励只能使用本地已存在的 item/equipment id，不能把原始掉落文本直接塞进运行奖励。
- 前端入口必须写“进入单机试炼 / 本地平衡 / 非官方完整数值”，避免误导为完整复刻。

## 本轮直接修复

- 新增 `tools/build_runtime_endgame_dungeons.mjs`。
- 新增 `data/design/runtime_endgame_dungeons.json`：
  - 9 个高阶单机试炼副本。
  - 9 张运行 dungeon map。
  - 59 个运行怪物，覆盖 `endgame_bosses.json` 全部 BOSS/对象。
  - 每个怪物带 `stat_confidence: single_player_balance`。
  - 每个副本带 `source_confidence: single_player_runtime_adapter`、`single_player_balance: true`、数值/技能/掉落/美术缺口。
- 前端加载后把 runtime maps/monsters/dungeons 合并进运行索引。
- 后期页展示单机试炼数量，并给可达等级角色提供“进入单机试炼”按钮。
- 后期页首屏新增透明提示：当前采用本地平衡，非官方完整数值。
- PWA 缓存新增 `runtime_endgame_dungeons.json`。

## 验收记录

- `node --check src/app.js`：通过。
- `node --check tools/build_runtime_endgame_dungeons.mjs`：通过。
- `npm run test:smoke`：通过，覆盖 9 副本、59 怪物、入口地图、奖励引用、数值正数、本地平衡标识。
- `npm run test:player`：通过，五职业 55 级模拟仍通过；高阶单机试炼模拟清完 59 个运行怪物。
- `npm run test:browser`：通过，真实横屏浏览器加载 378 图鉴、59 BOSS、9 单机试炼，并验证“本地平衡/非官方完整数值”可见。
- 截图：`test-results/p3-mobile-smoke.png`。

## 仍需补齐

1. 高阶副本现在可运行，但数值仍是单机模板，不是官方原始数值。
2. BOSS 技能时间轴、阶段机制、掉落权重仍未结构化。
3. 高阶副本地图/BOSS 美术未完成 AI Q 版化，运行时仍会 fallback。
4. 入口 NPC、钥匙、次数、失败结算还需要从本地资料继续细化。

## Loop 05 优先级

1. P0：给高阶单机试炼补 boss 阶段、限时、复活池、失败/退出结算。
2. P0：批量生成高阶 BOSS/地图 Q 版资产并接入 manifest。
3. P1：后期页从资料卡升级为可管理的副本选择界面，展示等级门槛、今日次数、掉落预览。
4. P1：宠物图鉴分页/搜索/懒加载，为后续 378 宠物美术接入做准备。
