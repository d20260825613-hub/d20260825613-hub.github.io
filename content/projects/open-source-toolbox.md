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

## 网络

| 工具 | 解决什么 | 仓库 |
| --- | --- | --- |
| netpeek | 扫局域网里有什么：活着的主机、开放的 TCP 端口、每个 MAC 背后的厂商。不需要管理员权限，不需要 Npcap | [netpeek](https://github.com/d20260825613-hub/netpeek) |
| dropjar | 把文件夹变成一个局域网网页，手机扫码即可双向传文件。零账号、零云、零数据线 | [dropjar](https://github.com/d20260825613-hub/dropjar) |

## 数据

| 工具 | 解决什么 | 仓库 |
| --- | --- | --- |
| jsonl | 查询大到打不开的 JSON Lines 文件：过滤、计数、取字段 | [jsonl](https://github.com/d20260825613-hub/jsonl) |
| tabkit | 看一眼表格的列、在 CSV/TSV/JSON/JSONL/Markdown 之间互转、用表达式筛行（不碰 `eval`） | [tabkit](https://github.com/d20260825613-hub/tabkit) |
| qwq | 从陌生人的视角审计一个仓库：缺哪些文件、文档能不能让人上手 | [qwq](https://github.com/d20260825613-hub/qwq) |

## 为什么都是零依赖

引一个包换来的便利，要用三样东西去还：`npx` 的冷启动要下载整棵依赖树、传递依赖带来的供应链风险、以及几年后某个下游包消失或改名导致的不可构建。

对"审计磁盘""加密一个文件""传一张照片"这类工具来说，这个交换不划算。代价是有些东西要自己写 —— 比如 dropjar 的二维码编码器，以及它那套"用独立解码器验证"的测试方式。两件事都写在各自的 README 里了。

## CI 标准

几个项目共用一套流水线约定：

- **测试矩阵**：3 个操作系统 × 4 个 Node 版本（18.17 / 20 / 22 / 24）。最低版本是 `engines` 里声明的那个，必须真的测。
- **零依赖断言**：CI 里有一道检查，`dependencies` 非空就直接失败。
- **打包安装验证**：把真实 tarball 装到临时 prefix，跑**装上去的那个命令**。这条路径上抓到过只有 CI 能发现的 bug（npm 在 POSIX 上把全局包装在 `lib/node_modules` 而不是 `node_modules`）。
- **端到端检查**：真实文件、真实 socket、真实子进程，断言 stdout 与退出码。

具体每个项目的门禁写在各自仓库的 README 里。
