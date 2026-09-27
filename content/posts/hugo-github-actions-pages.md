---
title: "用 Hugo + GitHub Actions 搭一个零成本的静态博客"
slug: "hugo-github-actions-pages"
date: 2026-09-27T10:10:00+08:00
draft: false
summary: "为什么选 Hugo、为什么主题直接 vendor 进仓库、为什么部署走 Actions 而不是本地 CLI，以及每一步踩到的坑。"
tags: ["Hugo", "GitHub Actions", "静态站点", "CI/CD"]
categories: ["工程实践"]
ShowToc: true
TocOpen: true
---

这套站点是这么长出来的。记下来主要是为了以后换机器时不用重新推一遍。

## 一、选型：为什么是 Hugo

选型只看了三个候选：Hugo、Hexo、Astro。

| | Hugo | Hexo | Astro |
| --- | --- | --- | --- |
| 运行时 | 单文件二进制 | Node + 一堆依赖 | Node + 构建器 |
| 冷构建（本博客规模） | 约 100 ms | 数秒 | 数秒，但装了 `node_modules` 之后体积大 |
| 主题生态 | 多，且质量稳定 | 多 | 新，偏现代 |
| 上手成本 | 配置即用 | 配置文件 + 插件链 | 需要理解 islands 概念 |

决定性的一条是**构建产物不依赖运行时**。Hugo 是一个二进制，CI 里只需要下载它、跑一次，不需要 `npm ci` 等三分钟。对个人博客这种"一年改几次、改完必须马上能发"的场景，构建时间和依赖数量比主题花哨程度重要得多。

## 二、主题：为什么 vendor 进仓库，而不是 submodule

Hugo 社区的常规做法是把主题加为 git submodule：

```bash
git submodule add https://github.com/adityatelange/hugo-PaperMod themes/PaperMod
```

我最后没有这么做，而是把主题文件**直接提交进仓库**（vendored）。原因：

1. CI 里少一次 `submodules: recursive` 的 checkout，少一个可能失败的网络步骤；
2. 主题升级变成一次正常的、可 review 的 diff，而不是一个悄悄指向别的 commit 的指针；
3. 克隆仓库的人 `git clone` 完就能构建，不用记得加 `--recursive`。

代价是仓库里多了约 6 MB 的主题文件，以及升级时要手动覆盖一次。对个人项目来说这个交换是值的。

> 如果哪天想换回 submodule，删掉 `themes/PaperMod` 再 `git submodule add` 即可，配置里只认 `theme: PaperMod` 这个名字，不关心它是怎么进来的。

## 三、搜索和评论为什么不引入服务

- **搜索**：PaperMod 用 Fuse.js。Hugo 在构建时把全部文章的标题、标签、正文摘要写进 `public/index.json`，浏览器下载后在本地做模糊匹配。**零后端、零请求费用**，代价是文章多到几千篇时 `index.json` 会变大（这个规模下无所谓）。
- **评论**：用 giscus，数据存在本仓库的 GitHub Discussions 里。没有自建数据库、没有第三方广告和追踪脚本，代价是评论者必须有 GitHub 账号。

这两个选择背后是同一条原则：**能用静态文件解决的，就不要引入一个需要运维的东西。**

## 四、部署：为什么不用本地脚本直传

一开始的方案是本地跑一个脚本，用 Wrangler CLI 把 `public/` 直接推到 Cloudflare Pages。它能用，但有两个问题：

- 发布能力绑在**某台机器**上。换电脑、重装系统、甚至是手机上有想法想发一篇文章，都发不了。
- 构建过程不在版本控制里。`hugo --minify --gc` 到底跑了什么、用的什么版本，只有那台机器知道。

改成 GitHub Actions 之后，发布流程变成了仓库里一个可以 review 的 YAML 文件：

```yaml
- name: Build
  run: hugo --minify --gc --baseURL "${{ steps.pages.outputs.base_url }}/"
```

任何一次 push 到 `main` 都会重新构建并发布，构建环境是干净的容器，Hugo 版本由 CI 配置里的版本号钉死。

## 五、几个具体的坑

### 1. 中文标题会变成百分号编码的 URL

文件名叫 `我的部署笔记.md`，默认生成的永久链接就是 `/posts/我的部署笔记/`，浏览器里会显示成一长串 `%E6%88%91...`。分享出去很难看。

解法是给每篇文章显式写 `slug`：

```yaml
---
title: "我的部署笔记"
slug: "deployment-notes"
---
```

配合 `permalinks` 配置，URL 就稳定成 `/posts/deployment-notes/`。

### 2. `baseURL` 在 CI 里必须正确

本地 `hugo server` 用相对路径没问题，但构建产物里的**绝对链接**（RSS、sitemap、`og:url`）会把 `baseURL` 写死。Actions 里应该用 `actions/configure-pages` 的输出，而不是手抄一遍域名——否则一旦换了自定义域名，RSS 里会残留旧地址。

### 3. 主题参数写错不会报错，只会静默失效

Hugo 的配置是宽松的：把 `ShowToc` 拼成 `ShowTOC`，构建照样成功，只是目录不显示。所以改完主题参数**一定要本地 `hugo server -D` 看一眼**，别只信"构建成功"。

## 六、日常发文

```bash
hugo new content posts/my-new-post.md   # 从 archetypes 生成带 front matter 的草稿
# 写内容，把 draft 改成 false
hugo server -D                          # 本地预览 http://localhost:1313
git add -A && git commit -m "post: my new post" && git push
```

push 之后 Actions 会自动构建发布，大约一分钟站点更新。就这样，不需要本机装任何部署工具。
