# QQFFO Single Player PWA

本仓库用于发布本地单人自玩版 H5/PWA。目标设备是 iPhone 横屏桌面化使用，也支持 Mac 浏览器体验。

## Play

GitHub Pages 发布后访问：

`https://chrislingxi.github.io/qqffo-single-player/`

## Local Run

```bash
npm run dev
```

打开 `http://127.0.0.1:5173/`。

## QA

```bash
npm run verify:p2-six
npm run test:smoke
npm run test:player
```

`npm run test:browser` 需要本机浏览器/CDP 环境，默认不在 GitHub Actions 中执行。

## Publish

```bash
npm run publish:pages
```

发布脚本会先跑基础校验，再把可运行资源推到 `gh-pages` 分支。

## Publish Scope

GitHub Pages 只发布运行所需内容：

- `index.html`
- `src/`
- `data/`
- `assets/game/qstyle/`
- `assets/pwa/`
- `manifest.webmanifest`
- `sw.js`

原始参考资料、参考截图、浏览器测试截图不进入网页发布产物。
