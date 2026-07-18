const CACHE_NAME = "ffo-pwa-v12-p33-rpg";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./src/styles.css",
  "./src/app.js",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/pwa/app-icon-192.png",
  "./data/design/classes.json",
  "./data/design/attribute_formulas.json",
  "./data/design/levels.json",
  "./data/design/skills.json",
  "./data/design/maps.json",
  "./data/design/npcs.json",
  "./data/design/monsters.json",
  "./data/design/spawns.json",
  "./data/design/items.json",
  "./data/design/equipment.json",
  "./data/design/drop_tables.json",
  "./data/design/pets.json",
  "./data/design/dungeons.json",
  "./data/design/quests.json",
  "./data/design/enhancement_rules.json",
  "./data/design/activities.json",
  "./data/design/advancement.json",
  "./data/design/pet_training.json",
  "./data/design/ascension.json",
  "./data/design/level_cap_110.json",
  "./data/design/late_growth.json",
  "./data/design/full_pet_catalog.json",
  "./data/design/pet_skills.json",
  "./data/design/pet_growth.json",
  "./data/design/pet_formations.json",
  "./data/design/pet_runtime_catalog.json",
  "./data/design/endgame_dungeons.json",
  "./data/design/endgame_bosses.json",
  "./data/design/runtime_endgame_dungeons.json",
  "./data/design/endgame_maps.json",
  "./data/design/endgame_materials.json",
  "./data/design/full_equipment_catalog.json",
  "./data/design/full_activity_catalog.json",
  "./data/design/source_gaps.json",
  "./data/design/p3_system_details.json",
  "./data/design/p3_m4_goal.json",
  "./data/design/p3_1_visual_goal.json",
  "./assets/game/qstyle/manifest.json",
  "./assets/game/qstyle/p32/bamboo-water-battlefield.png",
  "./assets/game/qstyle/p32/combat-foreground.png",
  "./assets/game/qstyle/p33/taoyuan-village.png",
  "./assets/game/qstyle/p33/fangcao-meadow.png",
  "./assets/game/qstyle/p33/yangyuan-plain.png",
  "./assets/game/qstyle/p33/flower-nest.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isRuntimeAsset = url.pathname.includes("/assets/game/qstyle/") || url.pathname.includes("/assets/pwa/");
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached && isRuntimeAsset) {
        event.waitUntil(fetch(event.request).then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }).catch(() => {}));
        return cached;
      }
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
