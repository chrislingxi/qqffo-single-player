# 发布与体验规范

## 目标

每个可体验版本都推送到 GitHub，并通过 GitHub Pages 自动部署，便于 iPhone / Mac 随时打开最新版本。

## 仓库

- GitHub 账号：`chrislingxi`
- 仓库：`qqffo-single-player`
- 分支：`main`
- Pages 链接：`https://chrislingxi.github.io/qqffo-single-player/`
- Pages 分支：`gh-pages`

## 发布规则

1. 每轮版本更新后，先运行基础校验。
2. 校验通过后提交到 `main`。
3. 执行 `npm run publish:pages`，脚本会重新校验并推送 `gh-pages` 体验版。
4. Pages 只发布可运行资源，不发布原始参考资料、参考截图、测试截图。

## 必跑校验

```bash
npm run verify:p2-six
npm run verify:vertical-slice
npm run test:smoke
npm run test:player
npm run test:vertical-player
```

`npm run test:browser` 用于本机浏览器体验验收，需要本地浏览器环境时再运行。
