/**
 * 站点验收：首页结构、视觉元素、栏目页/标签页没被首页模板污染、搜索索引条目、
 * 以及产物里引用的本地资源是否都存在。
 *
 * 用法：node scripts/verify-home.js
 * （放在项目 scripts/ 下，方便以后每次改首页后重跑）
 *
 * 历史教训：这个脚本原来对「其它页面」只断言 fs.existsSync()，于是
 * layouts/list.html 把 /posts/ 渲染成首页、content/tags.md 抢占 /tags/ 输出
 * 这两类事故全都被判成「全部通过」——文件确实存在，但内容是错的。
 * 所以下面凡是有意义的页面都做结构化内容断言，不只看文件在不在。
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
  console.error('public/index.html 不存在，先跑 hugo --gc --minify');
  process.exit(1);
}

/**
 * Normalise Hugo's minified HTML before matching.
 *
 * `--minify` drops the quotes around attribute values (`class=home-hero`) and
 * collapses whitespace, so a check written against pretty-printed HTML reports
 * false failures. Rewriting class/id/style attributes to the quoted form once,
 * here, keeps every assertion below readable.
 */
const unquote = (html) =>
  html.replace(
    /(\s(?:class|id|rel|aria-label|role|type|href|src|alt|datetime|width|height|loading|decoding|style|data-[\w-]+))=([^\s">]+)/g,
    '$1="$2"',
  );

const rawHome = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const home = unquote(rawHome);
const count = (re) => (home.match(re) ?? []).length;

/** 读一个产物页面（已做属性补引号），返回 null 表示文件不存在。 */
const readPage = (rel) => {
  const file = path.join(publicDir, rel);
  if (!fs.existsSync(file)) return null;
  return { file, html: unquote(fs.readFileSync(file, 'utf8')) };
};

console.log('=== 首页结构 ===');
check('有首屏区块 .home-hero', home.includes('class="home-hero"'));
check('有圆形头像 .home-avatar', home.includes('class="home-avatar"'));
check('有站名 .home-name 且内容正确', home.includes('d20260825613-hub 的个人博客'));
check('有个人简介 .home-bio', home.includes('class="home-bio"'));
check('有联系方式 chips', count(/class="home-chip/g) >= 3, `${count(/class="home-chip/g)} 个`);
check('邮箱可点击发信', home.includes('mailto:contact@example.com'));
check('有入口按钮 .home-link', count(/class="home-link"/g) >= 3, `${count(/class="home-link"/g)} 个`);
check('首屏只有一个 h1', count(/<h1/g) === 1, `${count(/<h1/g)} 个`);

console.log('\n=== 视觉元素 ===');
check('背景图已引用（桌面）', home.includes('hero-bg.jpg'));
check('背景图已引用（移动端）', home.includes('hero-bg-mobile.jpg'));
// 头像应当是本地文件（scripts/fetch-avatar.js 下载的），不是外链 ——
// 外链在国内经常超时，会变成破图。
check('头像走本地文件', home.includes('/img/avatar.png') || home.includes('avatar-placeholder.svg'));
check('没有引用外部头像', !home.includes('githubusercontent'));
check('有内联 SVG 图标', count(/svg-icon/g) >= 12, `${count(/svg-icon/g)} 个`);
check('图标是内联的（无外部图标请求）', home.includes('<svg class="svg-icon'), '');
// 遮罩强度直接进 CSS 自定义属性，非数字会让 home.css 的 calc() 整条失效
// （背景图不再被遮罩压暗）。这里断言它必须是 0~1 之间的数字。
// 注意 minify 会把 style 里最后一条声明的分号吃掉，所以结尾的分号是可选的。
const overlayRaw = (home.match(/--home-bg-overlay:\s*([^;"']*)/) ?? [])[1];
check(
  '遮罩强度 --home-bg-overlay 是 0~1 的合法数字',
  overlayRaw !== undefined && /^-?\d+(?:\.\d+)?$/.test(overlayRaw.trim()) && Number(overlayRaw) >= 0 && Number(overlayRaw) <= 1,
  overlayRaw ?? '未出现',
);

console.log('\n=== 项目卡片 ===');
check('四张项目卡片', count(/class="project-card"/g) === 4, `${count(/class="project-card"/g)} 张`);
for (const name of ['netpeek', 'dropjar', 'tabkit', 'spacehog']) {
  check(`卡片包含 ${name}`, home.includes(`>${name}</a>`) || home.includes(name));
}
check('有状态标签', count(/class="project-tag status-/g) === 4, `${count(/class="project-tag status-/g)} 个`);
check('状态标签有配色类', /status-(active|stable|planned)/.test(home));
check('每张卡片都有 GitHub 链接', count(/class="project-link"/g) === 4, `${count(/class="project-link"/g)} 个`);
check('每张卡片都有分类标签', count(/class="project-tags"/g) === 4, `${count(/class="project-tags"/g)} 组`);

console.log('\n=== 最新文章 ===');
check('有最新文章区块', home.includes('class="home-posts"'));
check('文章条目数正确', count(/class="post-row"/g) === 3, `${count(/class="post-row"/g)} 条`);

console.log('\n=== 导航与其它页面未被破坏 ===');
// 关于 是站点的可选入口：顶部导航里没有它也算正常（它由 /about/ 页面本身承载）。
// 这里断言的是"导航链接指向的页面都真的生成了"，下面统一检查文件存在性。
check('顶部导航含 项目', home.includes('href="/projects/"') || home.includes('/projects/'));
check('顶部导航含 文章', home.includes('href="/posts/"') || home.includes('/posts/'));
check('顶部导航含 标签', home.includes('href="/tags/"') || home.includes('/tags/'));
check('导航渲染了菜单链接', count(/class="menu"/g) >= 1 || home.includes('menu-item'));
for (const file of [
  'index.html',
  'index.json',
  'about/index.html',
  'archives/index.html',
  'tags/index.html',
  'categories/index.html',
  'search/index.html',
  'posts/index.html',
  'notes/index.html',
  'projects/index.html',
  'posts/three-zero-dependency-tools/index.html',
  'notes/powershell-git-through-proxy/index.html',
  'projects/open-source-toolbox/index.html',
  '404.html',
  'sitemap.xml',
  'index.xml',
]) {
  check(`生成 ${file}`, fs.existsSync(path.join(publicDir, file)));
}

console.log('\n=== 栏目页必须是栏目页，不是首页 ===');
// 事故现场：layouts/list.html（根级，优先级高于主题）里只写首页标记，
// section/taxonomy/term 三种 Kind 都回落到它，于是 /posts/ 变成首页副本，
// 栏目列表、分页、页面标题全部消失。只断言文件存在是发现不了的。
// 条数按仓库现状钉死：posts 2 篇、notes 1 篇、projects 1 篇。
// 新增文章后同步改这里的期望值（比 `>= 1` 这种阈值有用得多：
// 阈值对「整段列表被替换掉」完全无感，本次两个 high 级缺陷就是这么漏掉的）。
for (const [rel, entries] of [
  ['posts/index.html', 2],
  ['notes/index.html', 1],
  ['projects/index.html', 1],
]) {
  const page = readPage(rel);
  if (!page) {
    check(`${rel} 存在`, false, '文件缺失');
    continue;
  }
  const body = page.html;
  check(`${rel} 不含首页结构 home-hero`, !body.includes('class="home-hero"'));
  check(`${rel} 不含首页项目卡片 project-card`, !body.includes('class="project-card"'));
  check(`${rel} 有列表页头 page-header`, body.includes('class="page-header"'));
  const entryCount = (body.match(/class="(?:post-entry|first-entry)/g) ?? []).length;
  check(`${rel} 有文章条目（post-entry / first-entry）${entries} 条`, entryCount === entries, `${entryCount} 条`);
}
check('posts/index.html 保留栏目 RSS 入口', (readPage('posts/index.html')?.html ?? '').includes('/posts/index.xml'));

console.log('\n=== 标签总览页必须是分类法页，不是空文章 ===');
// 事故现场：content/tags.md 写了 url: "/tags/"，与 tag 分类法同路径且静默胜出，
// /tags/ 变成一篇没有标签列表的空文章，顶部「标签」菜单成了死入口。
{
  const tags = readPage('tags/index.html');
  if (!tags) {
    check('tags/index.html 存在', false, '文件缺失');
  } else {
    check('tags/index.html 有标签云 terms-tags', tags.html.includes('class="terms-tags"'));
    check('tags/index.html 不是单篇文章页 post-single', !tags.html.includes('class="post-single"'));
    check('tags/index.html 有页面头 page-header', tags.html.includes('class="page-header"'));
    // 只数标签云 <ul class="terms-tags"> 里的条目，别把导航/页脚里的链接也数进来。
    const cloud = /<ul class="terms-tags">([\s\S]*?)<\/ul>/.exec(tags.html)?.[1] ?? '';
    const terms = (cloud.match(/<li>/g) ?? []).length;
    // 站点当前 3 篇文章共 12 个不同标签 —— 钉死具体条数，不做 `>= 5` 这种宽松判断。
    check('tags/index.html 标签云列出 12 个标签', terms === 12, `${terms} 条`);
  }
  const cats = readPage('categories/index.html');
  check('categories/index.html 有标签云 terms-tags', Boolean(cats?.html.includes('class="terms-tags"')));
}

console.log('\n=== 搜索索引 ===');
const search = JSON.parse(fs.readFileSync(path.join(publicDir, 'index.json'), 'utf8'));
// 断言确切条目集合，而不是 `>= 6` 这种阈值：阈值对「多出/少掉一个页面」完全无感。
// 首页输出 JSON 时，PaperMod 的 index.json 模板只收录 RegularPages。
const expectedPaths = [
  '/about/',
  '/notes/powershell-git-through-proxy/',
  '/posts/hugo-github-actions-pages/',
  '/posts/three-zero-dependency-tools/',
  '/projects/open-source-toolbox/',
];
const actualPaths = search.map((e) => new URL(e.permalink).pathname).sort();
check(
  `搜索索引恰好 ${expectedPaths.length} 条且条目完全一致`,
  JSON.stringify(actualPaths) === JSON.stringify([...expectedPaths].sort()),
  actualPaths.join(', '),
);
check('搜索索引每条都有 title 与 summary', search.every((e) => e.title && typeof e.content === 'string'));
// 标签/分类总览页是分类法页，不该混进搜索索引（内容页才该进）。
check('搜索索引不含 /tags/ 分类法页', !actualPaths.includes('/tags/'));

console.log('\n=== 文章页仍带评论 ===');
const post = fs.readFileSync(path.join(publicDir, 'posts', 'three-zero-dependency-tools', 'index.html'), 'utf8');
check('文章页含 giscus', post.includes('giscus.app'));
check('文章页不含首页样式结构', !post.includes('class="home-hero"'));

const css = fs.readdirSync(path.join(publicDir, 'assets', 'css')).find((f) => f.startsWith('stylesheet'));
const cssText = fs.readFileSync(path.join(publicDir, 'assets', 'css', css), 'utf8');
check('style 表里包含首页样式', cssText.includes('.home-hero') && cssText.includes('.project-card'));
// 压缩会把 `@media screen and (max-width: 768px)` 变成 `@media(max-width:768px)`，
// 所以只匹配断点本身。
check('style 表里含响应式断点', /max-width:\s*768px/.test(cssText), '');
check('style 表里含移动端背景图切换', cssText.includes('--home-bg-mobile'));
check('style 表里含减少动效偏好', cssText.includes('prefers-reduced-motion'));
check('背景图放 static（不经指纹处理）', fs.existsSync(path.join(publicDir, 'images', 'hero-bg.jpg')));

console.log('\n=== 产物里引用的本地资源必须存在 ===');
/**
 * 把产物里所有 html 的 src/href 抓出来，凡是站内路径就检查对应文件是否存在。
 *
 * 这条专门用来挡住「head 里输出一堆站点并不存在的图标文件名」这类问题：
 * 页面照样 200，但每次访问都产生若干 404 请求，只在浏览器控制台里能看见。
 */
const IGNORED_PATH_PREFIXES = [
  // Cloudflare 的邮箱混淆代理，由 CDN 在边缘处理，产物里不该有同名文件
  '/cdn-cgi/',
];
const referenced = new Map();
const allHtml = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) allHtml.push(full);
  }
})(publicDir);

for (const file of allHtml) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/\s(?:src|href|poster|data-src)=(?:"([^"]*)"|([^\s">]+))/g)) {
    const url = (m[1] ?? m[2] ?? '').trim();
    if (!url || url.startsWith('#') || url.startsWith('?')) continue;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue; // 外部协议 / 协议相对
    const pathname = url.split(/[?#]/)[0];
    if (!pathname.startsWith('/')) continue; // 只校验根相对路径，相对路径交给页面自身结构
    if (IGNORED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) continue;
    const target = path.join(publicDir, decodeURIComponent(pathname));
    // 目录形式的链接（/posts/）由 Pages 用 index.html 兜底
    const resolved = pathname.endsWith('/') ? path.join(target, 'index.html') : target;
    if (!referenced.has(resolved)) referenced.set(resolved, `${path.relative(publicDir, file)} → ${pathname}`);
  }
}

const missing = [...referenced.entries()].filter(([resolved]) => !fs.existsSync(resolved));
const missingIcons = missing.filter(([, from]) => /favicon|apple-touch-icon|safari-pinned-tab/.test(from));
check(
  `脚本/样式/图标等本地引用全部存在（共 ${referenced.size} 个）`,
  missing.length === 0,
  missing.length ? missing.slice(0, 8).map(([f, from]) => `${f} ← ${from}`).join(' | ') : '',
);
check('没有引用不存在的站点图标（favicon / apple-touch-icon 等）', missingIcons.length === 0, `${missingIcons.length} 个缺失`);

console.log('\n=== 搜索快捷键 / 站内搜索可用 ===');
// README 与 hugo.yaml 都写了「任意页面按 / 唤起搜索」，这里断言它真的落进产物。
check('首页注入了 / 唤起搜索的脚本', home.includes('searchInput') || home.includes('/search/'));
{
  const searchPage = readPage('search/index.html');
  check('搜索页有搜索框 #searchInput', Boolean(searchPage?.html.includes('id="searchInput"')));
  check('搜索页加载了主题搜索脚本', Boolean(searchPage?.html.includes('/assets/js/search')));
}

console.log(failures === 0 ? '\n站点验收：全部通过' : `\n站点验收：${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
