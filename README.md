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
├─ archetypes/default.md        新文章模板：hugo new content posts/xxx.md
├─ content/
│  ├─ about.md                 → /about/
│  ├─ search.md                → /search/（Fuse.js 站内搜索）
│  ├─ archives.md              → /archives/（按时间归档）
│  ├─ tags.md                  → /tags/
│  ├─ posts/                   → /posts/   长文
│  ├─ notes/                   → /notes/   短笔记、命令速查
│  └─ projects/                → /projects/ 自己维护的开源工具索引
├─ themes/PaperMod/            主题（vendored，见下文说明）
├─ static/                     原样拷贝到站点根目录（图片放 static/images/）
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

## 四、功能说明

| 功能 | 实现 | 说明 |
| --- | --- | --- |
| 暗色/亮色双主题 | PaperMod 内置 | `defaultTheme: auto` 跟随系统；右上角可手动切换并记住选择 |
| 站内搜索 | Fuse.js（主题内置） | 构建时输出 `public/index.json`，浏览器本地模糊匹配，零后端。任意页面按 <kbd>/</kbd> 唤起 |
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

## 五、主题为什么是 vendored

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

## 六、排错

| 现象 | 原因 / 解决 |
| --- | --- |
| Actions 报 `public/index.json missing` | `hugo.yaml` 里 `outputs.home` 少了 `JSON`，站内搜索会同时失效 |
| 搜索结果为空 | 同上；确认构建日志里 `index.json` 存在 |
| 改了主题参数没生效 | Hugo 配置是宽松的，拼错键名不报错只是静默失效。改完必须 `hugo server -D` 看一眼 |
| 文章 404 | `slug` 与链接不一致，或 `draft: true` 还没改 |
| RSS / og:url 里是旧域名 | `baseURL` 写死了。CI 里用 `configure-pages` 的输出，换域名时只改仓库设置 |
| 主题升级后构建失败 | Hugo 与主题版本不匹配，见上节；把 `HUGO_VERSION` 与主题一起升 |
| 评论不显示 | giscus App 未安装，或两个 ID 还是占位符 |

---

## 七、维护指引

- **发文章**：`hugo new content posts/xxx.md` → 写 → `git push`
- **改站点信息**：编辑 `hugo.yaml`（站名、简介、菜单、社交链接）
- **改导航菜单**：`hugo.yaml` 里的 `menu.main`，`weight` 决定顺序
- **升级 Hugo**：改 `deploy.yml` 里的 `HUGO_VERSION`，本地用同版本验证后再推
- **看部署历史 / 回滚**：仓库 → Actions → 选一次成功的 run → Re-run；或 Pages 设置里切换已部署版本
- **换自定义域名**：先在仓库 Settings → Pages → Custom domain 填写，再在 DNS 服务商加
  CNAME 记录指向 `d20260825613-hub.github.io`；`baseURL` 不用改（CI 会自动用 Pages 的实际地址）

---

## 八、许可

站点内容（`content/`）版权归作者所有。
主题 PaperMod 为 MIT 许可，见 `themes/PaperMod/LICENSE`。
