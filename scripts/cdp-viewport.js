/**
 * 用 Chrome DevTools Protocol 强制一个真实视口宽度，测量并截图。
 *
 * 为什么需要它：无头 Edge/Chrome 不接受小于约 500px 的 --window-size，
 * 传入 390 时实际视口仍是 492px。于是"窄屏布局对不对"根本无法用普通截图验证 ——
 * 之前我据此以为移动端有横向溢出，其实是把 492px 的渲染裁成了 390px 的图。
 * Emulation.setDeviceMetricsOverride 才能真正改视口。
 *
 * 用法：node scripts/cdp-viewport.js <width> [outPng]
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const width = Number(process.argv[2] ?? 390);
const outPng = process.argv[3] ?? null;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const URL = 'http://127.0.0.1:3111/';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cdp-'));
const edge = spawn(
  EDGE,
  [`--headless=new`, `--disable-gpu`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`, 'about:blank'],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ask the DevTools endpoint for the page target's WebSocket URL. */
async function targetUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Not up yet
    }
    await sleep(250);
  }
  throw new Error('the DevTools endpoint never came up');
}

/** Minimal CDP client: send a method, resolve on its id. */
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        close: () => socket.close(),
      }),
    );
    socket.addEventListener('error', reject);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { res, rej } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) rej(new Error(message.error.message));
        else res(message.result);
      }
    });
  });
}

let code = 0;
try {
  const client = await connect(await targetUrl());
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  // 关键调用：真正改变布局视口，而不是只改窗口
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await client.send('Page.navigate', { url: URL });
  await sleep(2500);

  const expression = `
    (() => {
      const out = [];
      const measure = (sel) => {
        const el = document.querySelector(sel);
        if (!el) { out.push(sel + '=MISSING'); return; }
        const r = el.getBoundingClientRect();
        out.push(sel + ' w=' + Math.round(r.width) + ' l=' + Math.round(r.left) + ' r=' + Math.round(r.right));
      };
      ['body', '.main', '.home', '.home-hero', '.home-bio', '.home-meta', '.home-links',
       '.home-projects', '.project-card', '.project-tags', '.header'].forEach(measure);
      out.push('viewport=' + window.innerWidth);
      out.push('scrollWidth=' + document.documentElement.scrollWidth);
      out.push('overflow=' + (document.documentElement.scrollWidth > window.innerWidth ? 'YES' : 'no'));

      // 量关键文字的实际可见颜色。半透明前景在这里会被解析成实际颜色值；
      // 也要看它下面压着什么，才能判断对比度。
      const style = (sel, prop) => {
        const el = document.querySelector(sel);
        if (!el) { out.push(sel + '.' + prop + '=MISSING'); return; }
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const behind = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          .slice(1, 4)
          .map((e) => e.tagName.toLowerCase() + '.' + (e.className || '').toString().split(' ')[0])
          .join('>');
        out.push(sel + '.' + prop + '=' + s[prop] + ' @y=' + Math.round(r.top) + ' over[' + behind + ']');
      };
      style('.home-section-head h2', 'color');
      style('.home-section:nth-of-type(2) .home-section-head h2', 'opacity');
      style('.project-name a', 'color');
      style('.project-tagline', 'color');
      style('.post-row-title', 'color');
      style('.home-bio', 'color');
      return out.join(' @@ ');
    })()
  `;
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  console.log(`=== 视口 ${width}px 实测 ===`);
  for (const part of String(result.result.value).split(' @@ ')) console.log(`  ${part}`);

  if (outPng) {
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
    console.log(`\n截图已保存: ${outPng}`);
  }
  client.close();
} catch (error) {
  console.error('CDP 失败:', error.message);
  code = 1;
} finally {
  edge.kill();
  await sleep(400);
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

process.exit(code);
