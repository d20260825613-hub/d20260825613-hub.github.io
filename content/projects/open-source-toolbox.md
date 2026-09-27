---
title: "开源小工具合集"
slug: "open-source-toolbox"
date: 2026-09-27T10:00:00+08:00
draft: false
summary: "我维护的几个零依赖小工具的索引：它们解决什么问题、怎么装、源码在哪。"
tags: ["工具", "开源", "Node.js"]
categories: ["工具链"]
ShowToc: true
TocOpen: true
---

这里放我自己写和维护的小工具。共同点是：**零运行时依赖**、单一职责、能直接用 `npx` 或 `node` 跑起来，不需要先读一篇文档。

## 磁盘与文件

| 工具 | 解决什么 | 仓库 |
| --- | --- | --- |
| spacehog | 审计一个目录树里"到底是什么在占地方"：重复文件、大文件、垃圾文件、稀疏文件、空目录 | [spacehog](https://github.com/d20260825613-hub/spacehog) |
| speck | 按**字节内容**而不是扩展名识别文件类型，并报告扩展名是否在说谎 | [speck](https://github.com/d20260825613-hub/speck) |
| sumcheck | 拿一份校验清单核对整个目录，区分"文件坏了"和"只是还没下载" | [sumcheck](https://github.com/d20260825613-hub/sumcheck) |
| lockbox | 用口令加密单个文件：scrypt 派生密钥 + AES-256-GCM | [lockbox](https://github.com/d20260825613-hub/lockbox) |

## 数据

| 工具 | 解决什么 | 仓库 |
| --- | --- | --- |
| jsonl | 查询大到打不开的 JSON Lines 文件：过滤、计数、取字段 | [jsonl](https://github.com/d20260825613-hub/jsonl) |
| qwq | 从陌生人的视角审计一个仓库：缺哪些文件、文档能不能让人上手 | [qwq](https://github.com/d20260825613-hub/qwq) |

> 新增工具会陆续补进这张表。每个仓库的 README 都写明了安装方式、退出码约定和维护指引。
