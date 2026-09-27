/**
 * 下载 GitHub 头像到 static/img/avatar.png，本地加载，不用外链。
 *
 * 为什么要这个脚本而不是直接 hotlink：
 *   - 外链会在访客浏览器里产生对 githubusercontent 的第三方请求（隐私 + 可用性依赖）
 *   - 国内访问 githubusercontent 经常超时，头像会变成破图
 *   - 本地文件还能被构建产物一起发布，离线预览也正常
 *
 * 走 _tools/gh-tunnel.js 的代理隧道：本机 hosts 把 github.com 全系域名指向
 * 127.0.0.1，且没有直连出口，只有 Clash 代理能出去（详见环境文档）。
 *
 * 用法：
 *   node scripts/fetch-avatar.js                  # 用默认账号
 *   node scripts/fetch-avatar.js <用户名>
 *   node scripts/fetch-avatar.js <用户名> 512     # 指定尺寸（GitHub 支持 1..4608）
 *
 * 头像地址规则：https://github.com/<user>.png?size=<n>
 * 它会 302 到 avatars.githubusercontent.com，所以必须手动跟随重定向，
 * 且每次跳转都要开一条新的隧道（换主机了）。
 */

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const { connectTunnel, withTunnelRetry } = await import('file:///D:/dsh/_tools/gh-tunnel.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const user = process.argv[2] || 'd20260825613-hub';
const size = Number(process.argv[3] || 512);
const outFile = path.join(root, 'static', 'img', 'avatar.png');

/** 一次 HTTPS GET，走新的隧道连接。 */
function request(url) {
  const parsed = new URL(url);
  return withTunnelRetry(
    () =>
      connectTunnel(parsed.hostname).then(
        (socket) =>
          new Promise((resolve, reject) => {
            const req = https.request(
              {
                host: parsed.hostname,
                path: parsed.pathname + parsed.search,
                method: 'GET',
                socket,
                agent: false,
                servername: parsed.hostname,
                timeout: 30000,
                headers: { 'user-agent': 'fetch-avatar', accept: 'image/*' },
              },
              (res) => resolve({ res, socket }),
            );
            req.on('error', reject);
            req.end();
          }),
      ),
    { attempts: 6, label: 'fetch-avatar' },
  );
}

let url = `https://github.com/${user}.png?size=${size}`;
console.log(`fetching avatar for ${user} (size ${size})`);

for (let hop = 0; hop < 6; hop += 1) {
  const { res, socket } = await request(url);

  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    res.resume();
    socket.destroy();
    url = new URL(res.headers.location, url).toString();
    console.log(`  redirect -> ${new URL(url).hostname}`);
    continue;
  }
  if (res.statusCode !== 200) {
    res.resume();
    socket.destroy();
    throw new Error(`HTTP ${res.statusCode} for ${url}`);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  socket.destroy();
  const buffer = Buffer.concat(chunks);

  // 校验确实是图片：不然可能把一张错误页当成头像存下来。
  // 注意 GitHub 的 `<user>.png` 端点实际返回的是 JPEG（实测 first bytes ffd8ff），
  // 所以这里按魔数识别真实格式，再如实报告，而不是强求 PNG。
  const kind = detectImage(buffer);
  if (!kind) {
    throw new Error(
      `the response is not an image (${buffer.length} bytes, first bytes ${buffer.subarray(0, 8).toString('hex')})`,
    );
  }

  fs.writeFileSync(outFile, buffer);
  console.log(`saved ${path.relative(root, outFile)} — ${kind}, ${(buffer.length / 1024).toFixed(1)} KB`);
  process.exit(0);
}

/** 按文件头判断图片类型，返回可读名称或 null。 */
function detectImage(buffer) {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'PNG';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'JPEG';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'WebP';
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return 'GIF';
  return null;
}

throw new Error('too many redirects');
