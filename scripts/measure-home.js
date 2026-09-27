/**
 * 量出首页各元素在窄屏下的真实宽度，用于定位横向溢出。
 *
 * 做法：把一段探针脚本注入构建产物，用无头浏览器的 --dump-dom 把 document.title
 * 取回来。比反复看截图猜要快得多，也不受控制台编码影响。
 *
 * 用法：node scripts/measure-home.js [width]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const width = Number(process.argv[2] ?? 414);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const indexHtml = path.join(root, 'public', 'index.html');
const probeHtml = path.join(root, 'public', 'probe.html');

const probe = `
<script>
window.addEventListener('load', function () {
  var out = [];
  function measure(selector) {
    var element = document.querySelector(selector);
    if (!element) { out.push(selector + '=MISSING'); return; }
    var rect = element.getBoundingClientRect();
    out.push(selector + ' w=' + Math.round(rect.width) + ' l=' + Math.round(rect.left) + ' r=' + Math.round(rect.right));
  }
  ['body', '.main', '.home', '.home-hero', '.home-bio', '.home-meta', '.home-links', '.home-projects', '.project-card', '.header'].forEach(measure);
  out.push('viewport=' + window.innerWidth);
  out.push('scrollWidth=' + document.documentElement.scrollWidth);
  out.push('bodyScrollWidth=' + document.body.scrollWidth);
  document.title = out.join(' @@ ');
});
</script>`;

const html = fs.readFileSync(indexHtml, 'utf8').replace('</body>', `${probe}\n</body>`);
fs.writeFileSync(probeHtml, html, 'utf8');

try {
  const dom = execFileSync(
    EDGE,
    [`--headless=new`, `--disable-gpu`, `--window-size=${width},900`, '--virtual-time-budget=6000', '--dump-dom', 'http://127.0.0.1:3111/probe.html'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const match = /<title>([\s\S]*?)<\/title>/.exec(dom);
  if (!match) {
    console.error('no <title> in the dumped DOM');
    process.exit(1);
  }
  console.log(`=== 首页宽度测量 @ ${width}px ===`);
  for (const part of match[1].split(' @@ ')) console.log(`  ${part}`);
} finally {
  fs.rmSync(probeHtml, { force: true });
}
