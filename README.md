# 家务打卡

两个人一起用的家务提醒打卡小工具（PWA）：一眼看出做没做，做完点一下打卡，看看这周谁做得多。

需求和方案见 [PLAN.md](PLAN.md)。

## 现在的进度：第 1 步 演示版

- 数据只存在这台手机上（localStorage），两个人的手机之间还不同步，也还不推送提醒。
- 部署到 Cloudflare、绑定自己的域名、添加到 iPhone 主屏幕：看 [docs/演示版部署.md](docs/演示版部署.md)。
- 界面截图在 [docs/screenshots/](docs/screenshots/)。

## 给开发者

```bash
npm install
npm run dev        # 本地开发
npm test           # 单元测试（排期和"该做了"的判定、统计、本地数据）
npm run build      # 类型检查 + 构建到 dist/
```

- Vite + Preact + TypeScript；service worker 用 vite-plugin-pwa（injectManifest，源文件 `src/sw.ts`）
- 排期、判定、统计都是纯函数：`src/domain/`
- 数据读写都走 `ChoreRepository` 接口（`src/data/repository.ts`），演示版实现是 `LocalChoreRepository`；第 2 步换成 Cloudflare Workers + D1，界面不用改
- 部署：Cloudflare Workers 静态资源（`wrangler.jsonc`），连接 GitHub 后每次推送自动执行 `npm run build` 和 `npx wrangler deploy`
- 图标和 iPhone 启动画面：`node scripts/generate-assets.cjs` 生成，结果已提交在 `public/`
- 界面走查（iPhone 尺寸，带断言和截图）：`scripts/demo-walkthrough.cjs`
