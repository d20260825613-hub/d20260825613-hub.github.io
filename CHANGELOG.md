# 更新日志

本仓库没有发布版本号（`hugo.yaml` / `README.md` 里只有 Hugo 与 PaperMod 的版本，不是站点自身的版本），
所以按日期记录变更，不做版本 bump。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
每条自「未发布」起按日期倒序排列。

## 2026-10-15

一次针对站点产物缺陷的修复（由外部审计确认，`_audit/d20260825613-hub.github.io.json`）。
站点本体不变，只修渲染与文档；构建 51 页、无 ERROR。

### 修复

- **栏目页/标签页被首页模板污染（high）**：`layouts/list.html` 原来是全局列表模板，
  没有 `.IsHome` 守卫，而 Hugo 会把 section / taxonomy / term 三种 Kind 全部回落到该文件，
  于是 `/posts/`、`/notes/`、`/projects/`、`/tags/`、`/tags/<term>/`、`/categories/<term>/`
  全部被渲染成首页副本——栏目文章列表、页面标题、分页一起消失。
  现在 `layouts/list.html` 只做分发：`.IsHome` 走新增的 `layouts/_partials/home-main.html`
  （首页实现原样搬过去），其余 Kind 走新增的 `layouts/_partials/list-fallback.html`
  （内容等同主题 `layouts/list.html`，`themes/` 未改一个字节）。
  修复后 `/posts/` 含 `post-entry` 且不含 `home-hero`，`/tags/hugo/` 恢复文章列表。
- **标签总览页被空文章抢占（high）**：删除 `content/tags.md`。它的 `url: "/tags/"`
  与 tag 分类法输出路径相同，Hugo 静默让页面内容胜出，`/tags/` 变成一篇没有标签列表的空文章
  （`post-single`、`<ul class=post-tags></ul>`、日期 `0001-01-01`），顶部「标签」菜单成为死入口。
  删除后 `/tags/` 由 PaperMod 的 `taxonomy.html` 正常渲染标签云。
- **遮罩强度写入非法 CSS（medium）**：`data/home.yaml` 的 `background.overlay` 原来被裸拼进
  CSS 自定义属性，写成非数字时构建成功但 `calc(var(--home-bg-overlay) + 0.14)` 非法，
  整条 `background` 声明被丢弃、首屏遮罩静默消失。现在模板先校验类型（非数字直接
  `errorf` 让构建失败并给出中文提示），再夹到 `[0, 1]`。
- **验收脚本假绿（medium）**：`scripts/verify-home.js` 原来对「其它页面」只断言文件存在，
  因此上述两个 high 级缺陷可以轻松通过验收。现在补充：栏目页不得含 `home-hero`/`project-card`
  且必须含 `page-header` 与确切条数的 `post-entry`、`/tags/` 必须是 `terms-tags` 标签云而非
  `post-single`、`index.json` 的条目集合精确匹配（不再用 `>= 6` 这类阈值）、
  以及产物里所有本地 `src`/`href` 引用（脚本、样式、图标）都必须真实存在。
- **图标 404（low）**：`hugo.yaml` 的 `params.assets` 只配了 `favicon`，主题为
  `favicon16x16`/`favicon32x32`/`apple_touch_icon`/`safari_pinned_tab` 输出了 4 个
  仓库里并不存在的默认文件名，每次访问稳定产生 3~4 个 404 请求。现在这 4 个键都指向已有的
  `/favicon.svg`（仓库只有一张图标；宁可尺寸/类型提示不准，也不要稳定 404）。
- **「按 / 唤起搜索」是空话（low）**：README 与 `hugo.yaml` 都写了这个快捷键，但主题
  `header.html` 的 `eq (site.GetPage .KeyName).Layout "search"` 在本站恒为假，
  产物里连 `accesskey` 都没有。现在在项目自己的 `layouts/_partials/extend_head.html`
  里监听 `keydown`：焦点不在输入框/可编辑区时按 `/`，在搜索页聚焦搜索框，其它页面跳转 `/search/`。

### 文档

- `README.md` 更正与代码不符的说明：头像路径（`static/images/avatar.webp` →
  实际 `data/home.yaml` 的 `profile.avatar: "/img/avatar.png"`，即 `static/img/avatar.png`）、
  第三节/第七节的换头像与排错说明；
- `README.md` 删除已被证伪的「其余页面**完全不受影响**」，改写第四节的模板分层说明
  （为什么会污染、现在如何分发、`list-fallback.html` 与主题的同步义务）、
  目录结构树、验收脚本职责；
- `README.md` 新增排错条目：栏目页变成首页、`/tags/` 变成空文章、按 `/` 没反应、
  `overlay` 非数字导致构建失败。

### 已知限制（本次未改，记录备查）

- `/categories/` 分类法总览页的标题仍是英文 `Categories`：PaperMod 的 i18n 只影响
  `breadcrumbs`/`toc` 等固定文案，分类法页的 `.Title` 来自 Hugo 对 taxonomy 名的复数化，
  项目里的 `i18n/zh-cn.yaml` 覆盖不到它（实测无效，已回退）。顶部导航目前也没有分类入口。
- 仓库没有发布版本号，本次不 bump（见本文件开头说明）。
