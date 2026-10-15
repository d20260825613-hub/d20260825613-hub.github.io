# 堆栈手记 · 个人静态博客

零成本、零服务器的个人技术博客。本地写 Markdown，`git push` 之后自动构建并发布上线。

- **线上地址**：<https://d20260825613-hub.github.io/>
- **技术栈**：Hugo（生成器）+ PaperMod（主题）+ GitHub Actions（CI/CD）+ GitHub Pages（托管）
- **费用**：0 元。站点托管、HTTPS 证书、CDN 全部由 GitHub Pages 提供

---

## 一、部署架构

```
                     git push main
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  GitHub Actions (.github/workflows/  │
        │  deploy.yml)                         │
        │                                      │
        │  1. checkout                         │
        │  2. configure-pages  → 得到 baseURL  │
        │  3. 下载 Hugo 0.166.0（版本钉死）     │
        │  4. hugo --minify --gc  →  public/   │
        │  5. 校验 index.html / index.json     │
        │  6. upload-pages-artifact            │
        └──────────────┬───────────────────────┘
                       │ artifact
                       ▼
        ┌─────────────────────────────┐
        │  deploy-pages               │
        │  → GitHub Pages（Fastly CDN）│
        └──────────────┬──────────────┘
                       ▼
        https://d20260825613-hub.github.io/
        （自动签发并续期 HTTPS 证书）
```

**关键点**：仓库里**没有任何自定义 Secret**。构建和发布都用 GitHub 自动注入的
`GITHUB_TOKEN`（权限在 workflow 里显式声明为 `pages: write` + `id-token: write`）。
这也是选 GitHub Pages 而不是第三方托管的直接原因——流水线自洽，没有"先去某个控制台
申请 token 再贴进 Secrets"的前置步骤。

### 为什么不用本地脚本直传

本地脚本（`hugo` + `wrangler`/`rsync`）能用，但发布能力会绑在某台机器上，而且构建
过程不在版本控制里。改成 Actions 之后，构建环境是干净容器、Hugo 版本写在 YAML 里、
每一次发布都有可追溯的日志。

---

## 二、目录结构

```
.
├─ hugo.yaml                   站点总配置（站名、菜单、主题参数、giscus）
├─ data/home.yaml              ★ 首页内容：个人信息、联系方式、项目卡片、背景图
├─ archetypes/default.md        新文章模板：hugo new content posts/xxx.md
├─ content/
│  ├─ about.md                 → /about/
│  ├─ search.md                → /search/（Fuse.js 站内搜索）
│  ├─ archives.md              → /archives/（按时间归档）
│  ├─ posts/                   → /posts/   长文
│  ├─ notes/                   → /notes/   短笔记、命令速查
│  └─ projects/                → /projects/ 自己维护的开源工具索引
├─ layouts/
│  ├─ list.html                ★ 列表模板分发器（只有 .IsHome 走工具箱首页，见第四节）
│  └─ _partials/
│     ├─ home-main.html        ★ 首页正文（工具箱主页）
│     ├─ list-fallback.html    栏目页 / 标签页 / 分类页的列表实现（等同主题 list.html）
│     ├─ extend_head.html      站内搜索快捷键（按 / 唤起）
│     ├─ comments.html         giscus 评论组件
│     └─ svg-icon.html         内联 SVG 图标集
├─ assets/css/extended/home.css ★ 首页样式（PaperMod 自动合并，无需改主题）
├─ static/
│  ├─ favicon.svg              站点图标（唯一的图标文件，head 里 5 处 link 都指向它）
│  ├─ images/
│  │  ├─ hero-bg.jpg           首页背景图 1600×900
│  │  ├─ hero-bg-mobile.jpg    首页背景图（窄屏 900×507）
│  │  └─ avatar-placeholder.svg 占位头像（头像文件缺失时用它兜底）
│  └─ img/avatar.png           真实头像（data/home.yaml 的 profile.avatar 指向这里）
├─ scripts/
│  ├─ verify-home.js           站点验收（首页结构 / 栏目页内容 / 搜索索引 / 本地资源）
│  ├─ measure-home.js          量各元素宽度，定位横向溢出
│  └─ cdp-viewport.js          强制真实视口测量 + 截图
├─ themes/PaperMod/            主题（vendored，见下文说明）
└─ .github/workflows/deploy.yml  CI/CD 流水线
```

构建产物 `public/` 和缓存 `resources/_gen/` 都在 `.gitignore` 里，不进版本控制。

---

## 三、本地开发

需要 **Hugo extended ≥ 0.146**（本站用 0.166.0 验证）。单文件二进制，无需 Node/Ruby。

```bash
# 本地预览（含草稿），默认 http://localhost:1313
hugo server -D

# 生产构建
hugo --gc --minify
```

Windows 上如果没装 Hugo，可以直接用带路径的二进制：

```powershell
D:\dsh\_tools\hugo-bin\hugo.exe server -D
```

### ⚠️ 改了 `assets/` 下的 CSS 之后，必须清 Hugo 的资源缓存

Hugo 把 `resources.Match` 的结果缓存在 `%LOCALAPPDATA%\hugo_cache`。修改
`assets/css/extended/*.css` **有时不会让缓存失效**，表现为"改了样式但页面没变"，
而 `--gc` 与删除 `public/`、`resources/` 都不管用。排查时先清缓存：

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\hugo_cache"
hugo --gc --minify
```

### 写一篇新文章

```bash
hugo new content posts/my-new-post.md
```

生成的草稿带完整 front matter。中文标题建议顺手填 `slug`（否则 URL 会变成百分号编码）：

```yaml
---
title: "中文标题"
slug: "english-short-name"     # → /posts/english-short-name/
date: 2026-10-01T10:00:00+08:00
draft: false                   # 改成 false 才会发布
summary: "列表页显示的一句话"
tags: ["标签A", "标签B"]
categories: ["工程实践"]
ShowToc: true
---
```

写完 `git push`，大约一分钟上线。

---

## 四、首页（个人开源工具箱主页）

首页不是博客列表页，而是**作品集式主页**：首屏给出"这是谁、做什么、怎么联系"，
紧接着是四张项目卡片。它和主题默认的列表页差别很大，所以单独实现。

### 结构

```
layouts/list.html            列表模板分发器（只做 .IsHome 判断）
├─ .IsHome → layouts/_partials/home-main.html   首页正文，只覆盖 "main" 块
│  ├─ 背景层（取决于 data/home.yaml 是否配了图片）
│  ├─ 首屏 .home-hero
│  │   ├─ 圆形头像 .home-avatar（真实头像缺失时回退占位 SVG）
│  │   ├─ 身份标签 .home-eyebrow「独立工具开发者」
│  │   ├─ 站名 .home-name「堆栈手记」
│  │   ├─ 简介 .home-bio
│  │   ├─ 联系方式 .home-meta（邮箱可点击发信 / 所在地 / 维护状态）
│  │   └─ 入口按钮 .home-links（GitHub / 博客 / RSS / 写邮件）
│  ├─ 项目卡片 .home-projects（四张，网格布局，窄屏自动单列）
│  └─ 最新文章 .home-posts（条数由 data/home.yaml 的 recentPosts 控制）
└─ 其它 Kind → layouts/_partials/list-fallback.html   等同主题 list.html：
   栏目页有 page-header + post-entry 列表 + 分页，标签/分类页走主题 taxonomy.html
```

### 为什么必须做 `.IsHome` 分发（踩过的坑）

Hugo 的列表模板查找里项目 `layouts/` 优先于主题 `layouts/`，而 **`.Kind` 为
`section`（`/posts/`、`/notes/`、`/projects/`）、`taxonomy`（`/tags/`、`/categories/`）、
`term`（`/tags/hugo/`）的页面都会回落到根级 `layouts/list.html`**。

所以早期版本把首页标记直接写在 `layouts/list.html` 里是个事故：`/posts/`、`/notes/`、
`/projects/` 与全部标签/分类页都被渲染成了首页副本 —— 栏目列表、页标题、分页一起消失
（分页尤其隐蔽：文章超过 10 篇后，旧文章会彻底没有入口）。现在：

- 只有真正的站点首页（`.IsHome`）走 `home-main.html`；
- 其余列表页一律调用 `list-fallback.html`，长相与主题 `layouts/list.html` 完全一致
  （`page-header` + `post-entry` + 分页），标签/分类页仍由主题 `taxonomy.html` 渲染；
- 页面内容文件**不要**写与分类法同路径的 `url:`（例如 `content/tags.md` 配
  `url: "/tags/"`）。Hugo 允许页面与分类法抢同一个输出路径、且静默由页面内容胜出：
  `/tags/` 会变成一篇没有标签列表的空文章，顶部「标签」菜单随即变成死入口；
- `themes/` 一个字节都不用改，主题升级不会与定制冲突；
- `list.html` 只定义 `main` 块，`<head>`（样式与搜索脚本）、导航、页脚仍由主题提供，
  所以站内搜索与导航栏的功能没有被重写。

> 主题升级后如果 `themes/PaperMod/layouts/list.html` 有变化，需要把
> `layouts/_partials/list-fallback.html` 跟着同步一次（它是那份模板的副本）。

### 内容全部在 `data/home.yaml`

改文字、加项目、换联系方式都只改这个文件，不需要碰模板：

| 字段 | 作用 |
| --- | --- |
| `profile.name` / `role` / `bio` | 站名、身份、简介 |
| `profile.avatar` | 头像路径，当前是 `/img/avatar.png`（对应 `static/img/avatar.png`）。换成别的文件就改这一行；文件不存在时自动回退到 `avatarFallback`，不会出现破图 |
| `contact.email` | 邮箱，同时生成 `mailto:` 链接 |
| `contact.chips` | 首屏那一排标签：邮箱 / 所在地 / 状态 |
| `links` | 入口按钮（GitHub / 博客 / RSS / 写邮件） |
| `projects` | 四张项目卡片：名称、一句话简介、状态、图标、仓库、元信息、分类标签 |
| `background.image` / `imageMobile` | 背景图（桌面 / 窄屏）。留空则不显示背景 |
| `background.overlay` | 遮罩强度，越大文字越清楚、图片越淡（默认 0.68；**必须写数字**，写成 `0.7 左右` 这类文本会让构建直接失败并给出明确提示，不会再静默产出失效的 CSS） |
| `recentPosts` | 首页「最新文章」条数，`0` 表示不显示 |

### 设计决策

**首页恒定深色，不跟随主题切换。** 这个页面是作品集门面，需求就是深色科技感。
跟随主题会带来两个具体问题：亮色主题下背景图（夜景）与白底相撞，淡出位置会留下
一条硬边；深色遮罩配浅色表面会变成灰蒙蒙的中间调。所以在 `.home` 上直接把
PaperMod 的主题变量改写为深色一组，首页在任何主题、任何系统偏好下都一致。
**文章页、列表页、搜索页不受影响，仍正常跟随主题切换。**
若想让首页跟随主题，删掉 `home.css` 里 `.home` 顶部那段变量覆盖即可，
其余样式都基于这些变量书写。

**背景图用 `absolute` + 固定高度，而不是 `position: fixed`。**
最初写成 fixed，结果图在整个视口一直存在，滚到项目卡片时仍会透出来；为了挡住它
给容器加实色底，又在亮色主题下变成一块白色面板。现在图片只包住首屏那一段，
往下自然淡出 —— 与主题色、页面总高都无关。

**卡片用足够不透明的底色。** 卡片区与背景图淡出区有交叠，半透明底会让卡片文字压在
中间调上、对比度不稳定。文字颜色也一并写死不依赖主题变量。

**图标是内联 SVG，不是图标字体或 sprite 文件。** 不产生额外请求，`stroke` 用
`currentColor` 因此自动跟随配色与 hover 状态，站点保持零第三方资源。

### 换图与验收

**换背景图**（建议横向 16:9，≥1600×900，jpg < 400 KB）：

```
static/images/hero-bg.jpg          桌面版
static/images/hero-bg-mobile.jpg   窄屏版（建议 900 宽）
```

**换头像**（建议正方形 ≥400×400，人脸居中，png/webp < 200 KB）：

```
static/img/avatar.png              默认路径，换掉这个文件即可（data/home.yaml 里的
                                   profile.avatar 指向它）
```

> `scripts/fetch-avatar.js <用户名> 512` 可以从 GitHub 头像自动下载到本地，
> 免去手动裁图；下载后确认 `data/home.yaml` 的 `profile.avatar` 指向该文件。

改完首页后跑验收脚本。它现在会断言：首页结构 / 视觉元素 / 四张卡片 / **栏目页与标签页
的内容结构**（`/posts/` 必须是栏目列表而不是首页副本、`/tags/` 必须是标签云）、
**搜索索引的确切条目集合**、以及**产物里引用的本地资源是否都存在**：

```bash
node scripts/verify-home.js
```

> 为什么断言要这么细：早期版本只检查「产物文件存在」，于是 `/posts/` 被首页模板接管、
> `/tags/` 被一篇空文章抢占这两类事故，脚本照样报「全部通过」。
> 新增文章后请把脚本里栏目页的条目数期望值一并更新。

需要看真实窄屏效果时用 `scripts/cdp-viewport.js`：无头 Edge/Chrome
**不接受小于约 500px 的窗口**，直接 `--window-size=390` 截图得到的是被裁过的假象
（会误判成"移动端横向溢出"）。它通过 CDP 的 `Emulation.setDeviceMetricsOverride`
强制真实视口，并把关键元素的实测宽度与计算颜色一并打印出来：

```bash
node scripts/cdp-viewport.js 390 shot.png    # 需先 hugo 构建并用本地静态服务托管 public/
```

---

## 五、功能说明

| 功能 | 实现 | 说明 |
| --- | --- | --- |
| 暗色/亮色双主题 | PaperMod 内置 | `defaultTheme: auto` 跟随系统；右上角可手动切换并记住选择 |
| 站内搜索 | Fuse.js（主题内置）+ `layouts/_partials/extend_head.html` | 构建时输出 `public/index.json`，浏览器本地模糊匹配，零后端。任意页面按 <kbd>/</kbd> 唤起（已在 `extend_head.html` 里实现；主题自带的 `accesskey` 机制在本站不生效，详见第七节） |
| 评论 | giscus | 数据存在本仓库的 GitHub Discussions，无广告无追踪。**需要一次性安装 giscus App，见下节** |
| 目录 / 代码复制 / 阅读时长 | PaperMod 内置 | 每篇可用 front matter 单独关闭 |
| RSS / sitemap | Hugo 内置 | `/index.xml`、`/sitemap.xml` |

### 评论组件的一次性配置

giscus 需要一个 GitHub App 授权（这是 GitHub 的机制，任何基于 Discussions 的评论系统都一样）：

1. 打开 <https://github.com/apps/giscus/installations/new>，选择本账号并授权本仓库；
2. 打开 <https://giscus.app/zh-CN>，填入仓库 `d20260825613-hub/d20260825613-hub.github.io`；
3. 页面会给出 `data-repo-id` 和 `data-category-id` 两个值；
4. 把 `hugo.yaml` 里的 `REPLACE_REPO_ID` / `REPLACE_CATEGORY_ID` 替换成这两个值；
5. 提交并推送，评论框即生效。

> 未配置时文章页不会报错，只是不显示评论区——因为 PaperMod 只有在 `comments: true`
> 且 giscus 参数有效时才渲染该区块。

---

## 六、主题为什么是 vendored

`themes/PaperMod/` 的文件**直接提交进了仓库**，而不是用 git submodule：

- CI 少一次 `submodules: recursive` 的 checkout，少一个可能失败的网络步骤；
- 主题升级变成一次可 review 的 diff，而不是一个悄悄指向别的 commit 的指针；
- 别人 `git clone` 完就能构建，不用记得加 `--recursive`。

代价是仓库里多了约 1 MB 主题文件，升级时要手动覆盖一次。

**当前锁定的主题版本**：`adityatelange/hugo-PaperMod` @ `d3768854d0`（master，2026-08）。
注意 **不要用 v8.0 这个 tag**：它发布于 2024-11，与 Hugo 0.158+ 不兼容——Hugo 从
0.158 起废弃了带 `partials/` 前缀的 partial 调用，v8.0 会直接构建失败
（`partial "partials/templates/_funcs/get-page-images" not found`）。

升级主题：

```bash
# 下载新版本 → 覆盖 themes/PaperMod → 本地 hugo server 看一遍 → 提交
```

---

## 七、排错

| 现象 | 原因 / 解决 |
| --- | --- |
| Actions 报 `public/index.json missing` | `hugo.yaml` 里 `outputs.home` 少了 `JSON`，站内搜索会同时失效 |
| 搜索结果为空 | 同上；确认构建日志里 `index.json` 存在 |
| 改了主题参数没生效 | Hugo 配置是宽松的，拼错键名不报错只是静默失效。改完必须 `hugo server -D` 看一眼 |
| 文章 404 | `slug` 与链接不一致，或 `draft: true` 还没改 |
| RSS / og:url 里是旧域名 | `baseURL` 写死了。CI 里用 `configure-pages` 的输出，换域名时只改仓库设置 |
| 主题升级后构建失败 | Hugo 与主题版本不匹配，见上节；把 `HUGO_VERSION` 与主题一起升 |
| 评论不显示 | giscus App 未安装，或两个 ID 还是占位符 |
| **改了 `assets/` 里的 CSS 但页面没变** | **Hugo 资源缓存**。清 `%LOCALAPPDATA%\hugo_cache` 再构建；`--gc` 与删 `public/` 都不管用 |
| 首页背景图不显示 | `data/home.yaml` 的 `background.image` 路径不对，或文件不在 `static/images/`。模板会检查文件是否存在，不存在就整层跳过（不会产生 404 请求） |
| 首页头像还是占位图 | `data/home.yaml` 的 `profile.avatar`（当前 `/img/avatar.png`，即 `static/img/avatar.png`）指向的文件不存在。文件放好或改对路径即生效 |
| 首页背景遮罩没生效 / 构建报 `background.overlay 必须是 0~1 之间的数字` | 遮罩值必须是数字。写成 `0.7 左右` 这类文本时模板会直接让构建失败（这是有意的：CSS 里非法值会静默丢弃整条 `background`，比构建失败更难查） |
| 首页在亮色主题下仍是深色 | **有意设计**，见第四节「设计决策」。想跟随主题就删掉 `.home` 顶部那段变量覆盖 |
| 首页文字压在背景图上不好读 | 调大 `data/home.yaml` 的 `background.overlay`（如 `0.8`，超出 `[0,1]` 会被自动夹住），或清空 `background.image` 关掉背景 |
| 栏目页（`/posts/` 等）变成首页的样子 | `layouts/list.html` 丢了 `.IsHome` 分发。栏目/标签/分类页都会回落到根级 `layouts/list.html`，它必须把非首页分支交给 `layouts/_partials/list-fallback.html` |
| `/tags/` 变成一篇没有标签列表的空文章 | 有 `content/` 下的页面写了 `url: "/tags/"`，与分类法抢输出路径且静默胜出。删掉那个 `url:`（或那个文件），让 PaperMod 的 `taxonomy.html` 去渲染它 |
| 按 <kbd>/</kbd> 没反应 | `layouts/_partials/extend_head.html` 没被读到（项目 `layouts/` 是否覆盖生效）。快捷键由这里的脚本实现，**不要**指望主题的 `accesskey`：`themes/PaperMod/layouts/_partials/header.html` 里 `eq (site.GetPage .KeyName).Layout "search"` 在本站恒为假，菜单项上连 `accesskey` 都不会输出 |

---

## 八、维护指引

- **发文章**：`hugo new content posts/xxx.md` → 写 → `git push`
- **改首页内容**：编辑 `data/home.yaml`（个人信息、联系方式、项目卡片）；样式在
  `assets/css/extended/home.css`
- **改首页背景 / 头像**：背景替换 `static/images/hero-bg.jpg`、`hero-bg-mobile.jpg`；
  头像替换 `static/img/avatar.png`（或改 `data/home.yaml` 的 `profile.avatar` 指向新文件）
- **改完首页跑验收**：`node scripts/verify-home.js`（首页结构 + 栏目页/标签页结构 +
  搜索索引条目 + 本地资源引用，全部断言到具体内容，不是"文件存在"）
- **新增文章后**：把 `scripts/verify-home.js` 里栏目页条目数与搜索索引期望集合更新一次
- **改列表页长相**：`layouts/_partials/list-fallback.html`（等同主题 `list.html`）。
  改完务必确认 `/posts/` 仍是栏目列表：它要有 `page-header` 与 `post-entry`
- **改站点信息**：编辑 `hugo.yaml`（站名、简介、菜单、社交链接）
- **改导航菜单**：`hugo.yaml` 里的 `menu.main`，`weight` 决定顺序
- **升级 Hugo**：改 `deploy.yml` 里的 `HUGO_VERSION`，本地用同版本验证后再推
- **看部署历史 / 回滚**：仓库 → Actions → 选一次成功的 run → Re-run；或 Pages 设置里切换已部署版本
- **换自定义域名**：先在仓库 Settings → Pages → Custom domain 填写，再在 DNS 服务商加
  CNAME 记录指向 `d20260825613-hub.github.io`；`baseURL` 不用改（CI 会自动用 Pages 的实际地址）

---

## 九、许可

站点内容（`content/`）版权归作者所有。
主题 PaperMod 为 MIT 许可，见 `themes/PaperMod/LICENSE`。
