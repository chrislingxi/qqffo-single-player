# P3 多 Agent 本地化与试玩审计记录 Loop 06

更新时间：2026-07-05

## 本轮目标

修复 Loop05 截图中高阶 BOSS 仍显示红色 fallback 圆形的问题，先完成通天魔劫塔守关 BOSS 的 Q 版 runtime sprite，作为高阶美术批量化的质量闸门。

## 本轮直接修复

- 使用内置图片生成能力产出 `通天魔劫塔守关BOSS` Q 版商业手游 sprite。
- 保存源图：
  - `assets/game/qstyle/ai/sprites/source/tongtian_guardian_boss_chromakey.png`
- 使用 chroma key 本地去背景，生成透明 PNG：
  - `assets/game/qstyle/ai/sprites/tongtian_guardian_boss.png`
- 更新 `assets/game/qstyle/manifest.json`：
  - 为 `runtime_endgame_通天魔劫塔_monster_1_通天魔劫塔守关BOSS` 增加 Q 版 sprite 映射。
- 更新 PWA：
  - 缓存名从 `ffo-pwa-v3` 升到 `ffo-pwa-v4`。
  - 缓存新增 `tongtian_guardian_boss.png`。
- 修复本地 PWA 迭代缓存问题：
  - `loadData()` 对所有 JSON 加 `?v=p3-loop06`。
  - `fetch(..., { cache: "reload" })`，避免 iPhone/PWA/Chrome 继续吃旧 manifest。

## 验收记录

- `npm run test:smoke`：通过，新增通天塔 BOSS Q 版资产断言。
- `npm run test:browser`：通过，真实横屏浏览器：
  - 加载 21 条 qAsset manifest。
  - 检查通天塔守关 BOSS asset 存在。
  - 进入 `runtime_endgame_通天魔劫塔`。
  - 截图确认红色 fallback 圆形已替换为 Q 版 BOSS sprite。
- 截图：`test-results/p3-mobile-smoke.png`。

## 仍需补齐

1. 目前仅通天魔劫塔守关 BOSS 完成 Q 版 runtime sprite。
2. 夜影村、妖皇府、先祖山、迷雾沼泽等 58 个高阶对象仍需批量 AI Q 版化。
3. 透明抠图流程可用，但后续需要批量脚本化，并逐张截图验收。
4. 高阶地图仍是程序化 dungeon 背景，缺原图参考后的 Q 版地图。

## Loop 07 优先级

1. P0：批量生成夜影村、妖皇府、先祖山首批 BOSS sprite，每个副本至少覆盖主 BOSS。
2. P0：后期副本选择页商业化重构，避免所有资料藏在折叠审计明细里。
3. P1：将 BOSS sprite 尺寸、锚点、血条位置做 per-asset 配置，避免大型 BOSS 遮挡。
