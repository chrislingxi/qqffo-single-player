import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const resultDir = join(root, "test-results");
const endpoint = "http://localhost:9223";
const targetUrl = "http://localhost:5173";

async function chromeJson(path, init) {
  const response = await fetch(`${endpoint}${path}`, init);
  if (!response.ok) throw new Error(`Chrome endpoint failed ${response.status}: ${path}`);
  return response.json();
}

async function connect() {
  const tab = await chromeJson(`/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" });
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  return {
    send(method, params = {}) {
      id += 1;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      ws.close();
    }
  };
}

async function waitFor(cdp, expression, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.result.value) return result.result.value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result.value;
}

const cdp = await connect();
try {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.send("Page.navigate", { url: targetUrl });
  await waitFor(cdp, "Boolean(document.querySelector('.class-card') || document.querySelector('.mmo-shell'))");
  await evaluate(cdp, `
    (async () => {
      localStorage.removeItem('ffo_p2_save_v1');
      localStorage.removeItem('ffo_p1_save_v1');
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      location.reload();
      return true;
    })()
  `);
  await waitFor(cdp, "Boolean(document.querySelector('.class-card'))");
  const createScroll = await evaluate(cdp, `
    (() => {
      const page = document.querySelector('.create');
      const before = page.scrollTop;
      page.scrollTop = 999;
      return {
        before,
        after: page.scrollTop,
        clientHeight: page.clientHeight,
        scrollHeight: page.scrollHeight,
        overflowY: getComputedStyle(page).overflowY,
        touchAction: getComputedStyle(page).touchAction
      };
    })()
  `);
  if (createScroll.scrollHeight <= createScroll.clientHeight || createScroll.after <= createScroll.before) {
    throw new Error(`Create screen cannot scroll on portrait mobile: ${JSON.stringify(createScroll)}`);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true
  });
  await evaluate(cdp, `
    document.querySelector('[data-class="assassin"]').click();
    document.querySelector('#heroName').value = '测试刺客';
    document.querySelector('#startGame').click();
    true;
  `);
  await waitFor(cdp, "Boolean(document.querySelector('.mmo-shell') && document.querySelector('canvas'))");
  await new Promise((resolve) => setTimeout(resolve, 7000));
  const state = await evaluate(cdp, `
    (() => {
      const save = JSON.parse(localStorage.getItem('ffo_p2_save_v1'));
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        level: save.level,
        classId: save.classId,
        mapId: save.mapId,
        hp: save.hp,
        mp: save.mp,
        completedQuests: save.completedQuests.length,
        activeQuestId: save.activeQuestId,
        kills: save.stats.kills,
        canvasWidth: Math.round(rect.width),
        canvasHeight: Math.round(rect.height),
        shellSize: (() => {
          const rect = document.querySelector('.mmo-shell').getBoundingClientRect();
          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        })(),
        hasHud: Boolean(document.querySelector('.hud')),
        hasTabs: document.querySelectorAll('.tabs button').length,
        hasTopMenu: document.querySelectorAll('.top-menu .mmo-icon').length,
        hasSideMenu: document.querySelectorAll('.side-menu .round-tool').length,
        hasChat: Boolean(document.querySelector('.chat-bar')),
        hasQuestTrack: Boolean(document.querySelector('.quest-track')),
        hasMiniMap: Boolean(document.querySelector('.mini-map')),
        hasSkillWheel: Boolean(document.querySelector('.skill-wheel .attack-btn')),
        hudOpen: document.querySelector('.hud')?.classList.contains('open'),
        hasCombatFx: Array.isArray(save.fx) && save.fx.length > 0,
        forbiddenText: /好友|空间|排行|队伍|云舟客|三清岛|小道人|狐仙/.test(document.body.innerText),
        hasP3SaveShape: Boolean(save.progression && save.activityRuns),
        aiSpriteLoaded: Array.from(document.images || []).length
      };
    })()
  `);
  if (state.classId !== "assassin") throw new Error("Class creation did not persist selected class");
  if (state.canvasWidth < 760 || state.canvasHeight < 340) throw new Error("Canvas is too small on landscape mobile viewport");
  if (!state.hasHud || state.hasTabs !== 7) throw new Error("HUD tabs did not render");
  if (state.hudOpen) throw new Error("Drawer panel should not cover the default MMO playfield");
  if (state.hasTopMenu !== 6 || state.hasSideMenu !== 3 || !state.hasChat || !state.hasQuestTrack || !state.hasMiniMap || !state.hasSkillWheel) {
    throw new Error("P3 MMO HUD did not render completely");
  }
  if (state.forbiddenText) throw new Error("Single-player build contains social/fake-player text");
  if (!state.hasP3SaveShape) throw new Error("P3 save shape was not initialized");
  if (!state.hasCombatFx) throw new Error("Combat feedback effects were not produced during browser smoke");
  if (state.completedQuests < 1 && state.kills < 1) throw new Error("Auto quest/combat did not progress after startup");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const portraitGame = await evaluate(cdp, `
    (() => {
      const shell = document.querySelector('.mmo-shell');
      const canvas = document.querySelector('canvas');
      const shellRect = shell.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const topMenuRect = document.querySelector('.top-menu').getBoundingClientRect();
      return {
        innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        shellWidth: Math.round(shellRect.width),
        canvasWidth: Math.round(canvasRect.width),
        topMenuRight: Math.round(topMenuRect.right),
        rotateLockVisible: getComputedStyle(document.querySelector('.rotate-lock')).display !== 'none',
        hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2 || document.body.scrollWidth > innerWidth + 2
      };
    })()
  `);
  if (portraitGame.hasHorizontalOverflow || portraitGame.shellWidth > portraitGame.innerWidth + 2 || portraitGame.topMenuRight > portraitGame.innerWidth + 2) {
    throw new Error(`Portrait game viewport is horizontally clipped: ${JSON.stringify(portraitGame)}`);
  }
  if (!portraitGame.rotateLockVisible) {
    throw new Error(`Portrait game should show rotate lock: ${JSON.stringify(portraitGame)}`);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const drawerScroll = await evaluate(cdp, `
    (() => {
      document.querySelector('.top-menu .mmo-icon[data-tab="map"]').click();
      const panel = document.querySelector('.panel-body');
      const hudRect = document.querySelector('.hud').getBoundingClientRect();
      const before = panel.scrollTop;
      panel.scrollTop = 999;
      return {
        before,
        after: panel.scrollTop,
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
        overflowY: getComputedStyle(panel).overflowY,
        touchAction: getComputedStyle(panel).touchAction,
        hudRight: Math.round(hudRect.right),
        viewportMid: Math.round(innerWidth / 2)
      };
    })()
  `);
  if (drawerScroll.scrollHeight > drawerScroll.clientHeight && drawerScroll.after <= drawerScroll.before) {
    throw new Error(`Drawer panel cannot scroll: ${JSON.stringify(drawerScroll)}`);
  }
  if (drawerScroll.hudRight > drawerScroll.viewportMid) {
    throw new Error(`Drawer panel covers the combat center line: ${JSON.stringify(drawerScroll)}`);
  }
  const beforeDrawerRun = await evaluate(cdp, `
    (() => {
      const save = JSON.parse(localStorage.getItem('ffo_p2_save_v1'));
      return { kills: save.stats.kills, fxCount: save.fx?.length || 0, combat: Boolean(save.combat), playSeconds: save.stats.playSeconds, target: Boolean(save.target) };
    })()
  `);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const afterDrawerRun = await evaluate(cdp, `
    (() => {
      const save = JSON.parse(localStorage.getItem('ffo_p2_save_v1'));
      return { kills: save.stats.kills, fxCount: save.fx?.length || 0, combat: Boolean(save.combat), playSeconds: save.stats.playSeconds, target: Boolean(save.target) };
    })()
  `);
  if (afterDrawerRun.kills < beforeDrawerRun.kills || afterDrawerRun.playSeconds <= beforeDrawerRun.playSeconds + 1) {
    throw new Error(`Game loop did not continue under drawer: ${JSON.stringify({ beforeDrawerRun, afterDrawerRun })}`);
  }
  await evaluate(cdp, `
    (() => {
      const save = JSON.parse(localStorage.getItem('ffo_p2_save_v1'));
      save.level = Math.max(save.level, 16);
      save.pets = [{
        uid: 'pet_browser_strong_panel',
        id: 'fenfen_bunny_pet',
        name: '粉粉兔',
        level: 6,
        exp: 0,
        trust: 66,
        hunger: 12,
        skillLevel: 2,
        training: 1,
        circle: true
      }];
      save.activePetId = 'pet_browser_strong_panel';
      localStorage.setItem('ffo_p2_save_v1', JSON.stringify(save));
      window.location.reload();
      return true;
    })()
  `);
  await waitFor(cdp, "Boolean(document.querySelector('.mmo-shell') && document.querySelectorAll('.top-menu svg').length >= 6)");
  const p3Panel = await evaluate(cdp, `
    (() => {
      document.querySelector('.top-menu .mmo-icon[data-tab="activity"]').click();
      const text = document.body.innerText;
      document.querySelector('.top-menu .mmo-icon[data-tab="bag"]').click();
      const bagText = document.body.innerText;
      document.querySelector('.top-menu .mmo-icon[data-tab="pet"]').click();
      const petText = document.body.innerText;
      const petSvgCount = document.querySelectorAll('.panel-body .skill-icon svg, .panel-body .icon-frame svg').length;
      document.querySelector('.top-menu .mmo-icon[data-tab="endgame"]').click();
      const endgameText = document.body.innerText;
      const endgameScrollTop = document.querySelector('.panel-body')?.scrollTop || 0;
      const closeVisible = Boolean(document.querySelector('.drawer-close'));
      document.querySelector('.drawer-close').click();
      return {
        hasSvgSystemIcons: document.querySelectorAll('.top-menu .mmo-icon .icon-frame svg').length >= 6,
        oldGlyphIconsGone: !Array.from(document.querySelectorAll('.top-menu .mmo-icon i')).some((node) => /卷|囊|图|宠|令|塔/.test(node.textContent)),
        hasActivity: /试炼|怪物猎杀令|通天塔/.test(text),
        hasEnhance: /加工武器|打孔镶嵌|附魂/.test(bagText),
        hasAiManifest: Boolean(window.__ffoData?.qAssets?.some?.((asset) => asset.asset_maturity === 'ai_q_runtime_v1')),
        hasTongtianBossAsset: Boolean(window.__ffoData?.qAssetById?.['runtime_endgame_通天魔劫塔_monster_1_通天魔劫塔守关BOSS']),
        hasEndgame: /P3 后期目标|幻神|龙翼秘宝|翅膀雕花|通天魔劫塔/.test(endgameText),
        hasP3Rules: Boolean(window.__ffoData?.p3SystemDetails?.systems?.some?.((system) => system.id === 'dragon_wing_treasure')),
        petCatalogCount: window.__ffoData?.petRuntimeCatalog?.count,
        bossCount: window.__ffoData?.endgameBosses?.boss_count,
        runtimeDungeonCount: window.__ffoData?.runtimeEndgameDungeons?.dungeon_count,
        runtimeMonsterCount: window.__ffoData?.runtimeEndgameDungeons?.monster_count,
        mergedRuntimeDungeon: Boolean(window.__ffoData?.dungeonById?.runtime_endgame_夜影村),
        hasPetCatalog: /全宠物图鉴|目录身份表/.test(petText),
        hasPetStrongPanel: /生命|法力|等级|饥渴|信赖|命中|魔攻|魔防|力量|体质|敏捷|智慧|灵巧|精神|战斗技能|生活技能|我的宠物列表/.test(petText),
        petSvgCount,
        hasMapSceneProfiles: window.__ffoData?.mapScenes?.length >= 13,
        hasMultiSpawnZones: ['fangcao','fangcao_east','fangcao_west','yangyuan_mid','longcheng_south','longcheng_north'].every((mapId) => window.__ffoData?.spawns?.filter?.((spawn) => spawn.mapId === mapId).length >= 2),
        hasTrialCopy: /进入单机试炼|本地平衡，非官方完整数值/.test(endgameText),
        catalogOnlySafe: !/ffo_pet_378[\s\S]{0,120}(捕捉|出战)/.test(petText),
        noBrokenText: !/undefined|NaN/.test(petText + '\\n' + endgameText),
        tabScrollReset: endgameScrollTop < 5,
        runtimeClean: !/好友|空间|排行|队伍|组队|交易|可交易|玩家相互|帮派|家族|社交|竞争/.test(JSON.stringify({
          dungeons: window.__ffoData?.endgameDungeons?.records?.map?.((dungeon) => dungeon.single_player_runtime),
          materials: window.__ffoData?.endgameMaterials?.runtime_materials,
          activities: window.__ffoData?.fullActivityCatalog?.activities?.map?.((activity) => activity.single_player_runtime)
        })),
        closeVisible,
        hudClosed: !document.querySelector('.hud')?.classList.contains('open')
      };
    })()
  `);
  if (!p3Panel.hasSvgSystemIcons || !p3Panel.oldGlyphIconsGone || !p3Panel.hasActivity || !p3Panel.hasEnhance || !p3Panel.hasAiManifest || !p3Panel.hasTongtianBossAsset || !p3Panel.hasEndgame || !p3Panel.hasP3Rules || p3Panel.petCatalogCount !== 378 || p3Panel.bossCount < 30 || p3Panel.runtimeDungeonCount !== 9 || p3Panel.runtimeMonsterCount !== p3Panel.bossCount || !p3Panel.mergedRuntimeDungeon || !p3Panel.hasPetCatalog || !p3Panel.hasPetStrongPanel || p3Panel.petSvgCount < 6 || !p3Panel.hasMapSceneProfiles || !p3Panel.hasMultiSpawnZones || !p3Panel.hasTrialCopy || !p3Panel.catalogOnlySafe || !p3Panel.noBrokenText || !p3Panel.tabScrollReset || !p3Panel.runtimeClean || !p3Panel.closeVisible || !p3Panel.hudClosed) {
    throw new Error(`P3 panels missing expected controls: ${JSON.stringify(p3Panel)}`);
  }
  await evaluate(cdp, `
    (() => {
      const save = JSON.parse(localStorage.getItem('ffo_p2_save_v1'));
      save.level = 110;
      save.hp = 99999;
      save.mp = 99999;
      save.gold = 999999;
      localStorage.setItem('ffo_p2_save_v1', JSON.stringify(save));
      location.reload();
      return true;
    })()
  `);
  await waitFor(cdp, "Boolean(document.querySelector('.mmo-shell') && window.__ffoData?.runtimeEndgameDungeons)");
  const endgameEntry = await evaluate(cdp, `
    (() => {
      document.querySelector('.top-menu .mmo-icon[data-tab="endgame"]').click();
      document.querySelector('details.audit-details').open = true;
      const button = document.querySelector('[data-runtime-dungeon="runtime_endgame_通天魔劫塔"]');
      if (!button || button.disabled) return { clicked: false, disabled: button?.disabled ?? null };
      button.click();
      return { clicked: true };
    })()
  `);
  if (!endgameEntry.clicked) throw new Error(`Runtime endgame entry was not clickable: ${JSON.stringify(endgameEntry)}`);
  await new Promise((resolve) => setTimeout(resolve, 700));
  const endgameState = await evaluate(cdp, `
    (() => {
      const save = JSON.parse(localStorage.getItem('ffo_p2_save_v1'));
      return {
        mapId: save.mapId,
        dungeonId: save.dungeon?.id,
        revivesLeft: save.dungeon?.revivesLeft,
        timerSeconds: save.dungeon?.timerSeconds,
        remaining: save.dungeon?.remaining,
        combat: Boolean(save.combat)
      };
    })()
  `);
  if (endgameState.dungeonId !== "runtime_endgame_通天魔劫塔" || endgameState.revivesLeft !== 5 || endgameState.timerSeconds !== 300 || endgameState.remaining < 1 || !endgameState.combat) {
    throw new Error(`Runtime endgame dungeon did not initialize mechanics: ${JSON.stringify(endgameState)}`);
  }
  await evaluate(cdp, "document.querySelector('.hud')?.classList.remove('open'); true");
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await mkdir(resultDir, { recursive: true });
  await writeFile(join(resultDir, "p3-mobile-smoke.png"), Buffer.from(screenshot.data, "base64"));
  console.log("P3 browser smoke passed", state);
} finally {
  cdp.close();
}
