# 数学学霸模拟器

手机 / 桌面双形态刷题 H5：段位爬塔、秘籍库、全国 / 地区排行榜、答错即时解析。
纯前端 + Cloudflare Pages Functions（KV 存储）部署，零运维。

- 在线仓库：https://github.com/f-klll/math-genius-app
- 本地预览：`node server/index.js` 后访问 http://localhost:8787

## 目录结构

```
index.html / app.js / data.js / manuals.js / styles.css   前端（375×812 手机壳 + 桌面双形态）
assets/                                                  表情包等静态资源
server/index.js                                          本地开发用零依赖 Node 后端（端口 8787）
functions/api/[[path]].js                                Cloudflare Pages Functions，接管 /api/*（排行榜 + 登录）
wrangler.toml                                            Cloudflare Pages 配置
```

## 本地运行

```bash
node server/index.js
# 打开 http://localhost:8787
```

前端在 HTTPS 环境下 `API_BASE=""` 自动走同源 `/api/*`；本地开发时 `server/index.js` 提供同样接口（数据存 `server/db.json`）。

## 部署到 Cloudflare（控制台一键连接 Git）

> 前端为静态文件，后端 `/api/*` 由 `functions/api/[[path]].js` 在 Cloudflare 边缘运行，数据存 KV。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers 和 Pages** → **创建** → **连接到 Git**。
2. 授权并选择仓库 **`f-klll/math-genius-app`**。
3. 构建设置：
   - 框架预设：**无（None）**
   - 构建命令：**留空**
   - 构建输出目录：**`.`**（仓库根目录，即前端静态文件所在）
4. （可选）环境变量：如需真实微信登录，添加 `WX_APPID` / `WX_SECRET`。
5. **必须绑定 KV**（排行榜持久化）：
   - 进入项目 **设置 → 函数 → KV 命名空间绑定**
   - 变量名填 **`DB`**，命名空间选一个已有的，或「创建命名空间」新建一个
6. 保存并 **部署**。部署完成后获得 `https://math-genius-app.pages.dev`（可再绑自定义域）。

> 提示：若暂未绑定 KV，`/api` 会自动降级为进程内内存存储（排行榜在冷启动 / 刷新后重置）。
> 正式使用请按第 5 步绑定 KV（绑定名必须为 `DB`）。

## 改用 wrangler CLI 部署（可选）

```bash
npx wrangler kv namespace create mathgenius_db --binding DB   # 记下返回的 id
# 把 wrangler.toml 里 [[kv_namespaces]].id 替换为上面的 id
npx wrangler pages deploy . --branch main
```

## 说明

- 排行榜 / 登录数据存于 Cloudflare KV（键 `db`），与本地 `server/db.json` 互不影响。
- 微信登录在缺少 `WX_APPID`/`WX_SECRET` 时走开发模拟（自动分配昵称与头像）。
