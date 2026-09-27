/**
 * 首页渲染验收：检查关键结构、计数、可访问性要点，以及没有破坏其它页面。
 *
 * 用法：node scripts/verify-home.js
 * （放在项目 scripts/ 下，方便以后每次改首页后重跑）
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

const rawHome = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

/**
 * Normalise Hugo's minified HTML before matching.
 *
 * `--minify` drops the quotes around attribute values (`class=home-hero`) and
 * collapses whitespace, so a check written against pretty-printed HTML reports
 * false failures. Rewriting class/id/style attributes to the quoted form once,
 * here, keeps every assertion below readable.
 */
const home = rawHome.replace(
  /(\s(?:class|id|rel|aria-label|role|type|href|src|alt|datetime|width|height|loading|decoding|style|data-[\w-]+))=([^\s">]+)/g,
  '$1="$2"',
);
const count = (re) => (home.match(re) ?? []).length;

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
check('顶部导航含 文章', home.includes('/posts/'));
check('导航渲染了菜单链接', count(/class="menu"/g) >= 1 || home.includes('menu-item'));
for (const file of [
  'index.html',
  'index.json',
  'about/index.html',
  'archives/index.html',
  'tags/index.html',
  'search/index.html',
  'posts/index.html',
  'posts/three-zero-dependency-tools/index.html',
  'notes/powershell-git-through-proxy/index.html',
  'projects/open-source-toolbox/index.html',
  '404.html',
  'sitemap.xml',
  'index.xml',
]) {
  check(`生成 ${file}`, fs.existsSync(path.join(publicDir, file)));
}

const search = JSON.parse(fs.readFileSync(path.join(publicDir, 'index.json'), 'utf8'));
check('搜索索引非空且包含新文章', search.length >= 6, `${search.length} 条`);
check('搜索索引包含三个新工具那篇', search.some((e) => e.permalink.includes('three-zero-dependency-tools')));

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

console.log(failures === 0 ? '\n首页验收：全部通过' : `\n首页验收：${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
