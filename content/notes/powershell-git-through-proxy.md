---
title: "PowerShell 与 Git：在没有直连网络的环境里推代码"
slug: "powershell-git-through-proxy"
date: 2026-09-27T10:20:00+08:00
draft: false
summary: "本机 github.com 全系域名被 hosts 指向 127.0.0.1，且完全没有直连出口。记录定位过程，以及最后那条能用的 git 命令为什么每个参数都不能少。"
tags: ["PowerShell", "Git", "网络", "排错"]
categories: ["工程实践"]
ShowToc: true
TocOpen: true
---

现象很朴素：`git push` 失败。定位过程比结论有用，所以完整记下来。

## 一、先分清是哪一层坏了

`git push` 报错会把人往认证问题上带，但**认证失败和网络失败是两件事**，先分开：

```powershell
# 1. DNS 解析到哪儿？
Resolve-DnsName github.com

# 2. 443 端口打得开吗？
Test-NetConnection github.com -Port 443
```

第一条命令是这个案子的关键。它返回：

```
Name      Type IPAddress
github.com  A  127.0.0.1
```

`github.com` 解析到了 `127.0.0.1`。这不是 DNS 被污染，而是**本机 hosts 文件里写了映射**：

```
127.0.0.1 github.com
127.0.0.1 api.github.com
127.0.0.1 raw.githubusercontent.com
...（共 30 余条）
```

所以任何直连都不可能成功，跟 token、跟代理都无关。

## 二、确认"没有直连出口"这件事

绕过 hosts 直接连真实 IP，结果全是超时：

```powershell
node -e "const n=require('net');['140.82.121.4','1.1.1.1','8.8.8.8'].forEach(h=>{const s=n.connect({host:h,port:443,timeout:8000},()=>{console.log(h,'OK');s.destroy()});s.on('timeout',()=>{s.destroy();console.log(h,'TIMEOUT')});s.on('error',e=>console.log(h,e.code))})"
```

```
140.82.121.4 TIMEOUT
1.1.1.1 TIMEOUT
8.8.8.8 TIMEOUT
```

连 `1.1.1.1:443` 都不通，说明不是"GitHub 被墙"，而是**这台机器根本没有对外直连**。唯一出口是本机的 Clash：

```powershell
Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 7897
```

## 三、为什么走代理能绕过 hosts

这一点值得单独说，因为它不直观：**HTTP 代理是自己去解析目标域名的。**

`git`（libcurl）遇到 `http.proxy` 时，对 HTTPS 会先发一个 `CONNECT github.com:443` 给代理，代理拿到的是**字符串主机名**，由代理那边去解析和连接。本机的 hosts 文件在这条路径上完全不参与。

所以一个"被 hosts 屏蔽的域名"，只要本机有可用代理，就能正常访问。验证一下隧道是通的：

```powershell
node -e "const h=require('http');const r=h.request({host:'127.0.0.1',port:7897,method:'CONNECT',path:'github.com:443'});r.on('connect',(res,s)=>{console.log('CONNECT',res.statusCode);s.destroy()});r.end()"
```

## 四、最后能用的那条命令

```powershell
git -c http.proxy=http://127.0.0.1:7897 `
    -c http.sslBackend=openssl `
    -c http.version=HTTP/1.1 `
    -c credential.helper= `
    -c "credential.helper=!node D:/dsh/_tools/git-token-helper.js" `
    push origin main
```

每个参数都是踩出来的，去掉任何一个都会以不同方式失败：

| 参数 | 去掉会怎样 |
| --- | --- |
| `http.proxy` | `schannel: failed to receive handshake`（其实连的是 127.0.0.1） |
| `http.sslBackend=openssl` | `schannel: failed to receive handshake, SSL/TLS connection failed`——schannel 的后端在这条代理链路上完不成握手 |
| `http.version=HTTP/1.1` | 不稳定：`github.com` 的隧道 TLS 握手约有**一半**会被重置，HTTP/2 的连接复用会让失败更集中 |
| `credential.helper=`（空） | 会回退到全局的 `gh auth git-credential`，而它读的是 keyring 里那个**已失效**的 token，于是得到 401 |
| `credential.helper=!node ...` | 没有凭据，推不上去 |

关于最后两条：**空的那个 `credential.helper=` 不是多余的**。Git 的 credential helper 是列表，先清空再追加，才能保证只用指定的那一个。这也解释了当时最迷惑的现象——`gh auth status` 说 token 无效，但 `git push` 报的却是 TLS 错误，两者其实毫无关系。

## 五、可复用的三条经验

1. **先看 DNS 和端口，再看认证。** `Resolve-DnsName` 一条命令就能把"网络问题"和"认证问题"分开，省掉半小时试 token。
2. **判断网络问题必须在干净进程里复测。** 同一个终端里手工设过 `HTTPS_PROXY` 之后再测，测的是上一个命令的残留，不是系统状态。
3. **约一半的握手会失败时，重试不是偷懒，是正确策略。** 与其花时间找一个"绝不失败"的参数组合，不如写一个重试 8 次、每次间隔 2 秒的包装脚本。上面那条命令被固化成了 `git-spacehog.ps1`，日常直接调用。
