import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [app, styles, html, sw] = await Promise.all([
  read("src/app.js"),
  read("src/styles.css"),
  read("index.html"),
  read("sw.js")
]);

assert(app.includes('DATA_VERSION = "p31-visual-01"') && html.includes('"p31-visual-01"'), "runtime and HTML cache-buster must point at the latest visual build");
assert(sw.includes("ffo-pwa-v10-p31-visual"), "service worker cache must be bumped for the visual build");
assert(app.includes("sideMenu.innerHTML = \"\""), "duplicated right-side module buttons must stay removed from the single-player HUD");
assert(styles.includes("P3.0 M4.1 EOF lock") && styles.trim().endsWith("}"), "side-menu hide rule must live in the final cascade lock");
assert(app.includes("chat-icon") && !app.includes("<button>战</button>") && !app.includes("<button data-action=\"save\">存</button>"), "chat/save controls must be graphical buttons, not bare text glyphs");
assert(app.includes("left-quest-tabs") && app.includes("aria-label=\"任务追踪\"") && styles.includes(".left-quest-tabs svg"), "left task tabs must use graphical icons instead of vertical text-only tabs");
assert(app.includes("renderPanel({ force: document.querySelector(\".hud\")?.classList.contains(\"open\") })"), "closed panels must not rebuild every frame-level render");
assert(app.includes("drawNavigationAids(camera);") && app.includes("drawWorldActors(camera);"), "actors must be drawn through a depth-sorted world actor pass");
assert(app.includes("actors.sort((a, b) => a.y - b.y)"), "world actors must sort by map Y to avoid player/monster layer inversions");
assert(app.includes("function drawFallbackSprite") && !app.includes('ctx.arc(x, y, Math.min(w, h) / 2'), "missing art must degrade to Q-style silhouettes, not a red placeholder circle");
assert(app.includes("drawSpawnZoneHints(camera)") && app.includes("spawnInstancesForMap().forEach"), "map monsters must remain visible ecosystem spawns instead of only close-range encounters");
assert(styles.includes("P3.0 M4.1 EOF lock") && styles.trim().endsWith("}"), "final CSS must include the experience lock");

console.log("UI experience audit passed");
