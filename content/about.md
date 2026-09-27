---
title: "关于"
url: "/about/"
hidemeta: true
ShowToc: false
ShowBreadCrumbs: false
comments: false
---

## 这个站点是什么

个人技术博客。主站源码在 [d20260825613-hub/d20260825613-hub.github.io](https://github.com/d20260825613-hub/d20260825613-hub.github.io)，用 Hugo 生成、GitHub Actions 构建、GitHub Pages 托管。

写在这里的东西大致三类：

- **工程实践**：踩过的坑、排查过程、最后怎么解决的。
- **工具链**：我自己写的小工具，以及为什么不用现成的。
- **读书与笔记**：技术书和长文的摘录与批注。

## 这个站点怎么搭的

| 部分 | 选型 | 理由 |
| --- | --- | --- |
| 生成器 | Hugo | 单文件二进制，构建秒级，无 Node/Ruby 运行时依赖 |
| 主题 | PaperMod | 一个主题即覆盖文章、目录、归档、标签、搜索，自带中英文界面 |
| 亮/暗主题 | PaperMod 内置 | 跟随系统，右上角可手动切换并记住选择 |
| 搜索 | Fuse.js（主题内置） | 构建时输出 `index.json`，在浏览器里查，零后端 |
| 评论 | giscus | GitHub Discussions 驱动，无广告、无追踪、无需自建服务 |
| CI/CD | GitHub Actions | 推送到 `main` 即自动构建并发布 |
| 托管 | GitHub Pages | 免费、自动 HTTPS、全球 CDN |

## 怎么联系

有问题或想讨论，在任意文章下用 giscus 留言（需要 GitHub 账号），或者到对应仓库提 issue。
