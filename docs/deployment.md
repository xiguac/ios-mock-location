# 云端部署

Shadowrocket 模块里的 `configUrl` 只需要指向一份坐标 JSON，所以可以用多种平台部署。不同方式的区别主要在于能不能在线保存坐标。

| 方式 | 能否网页保存坐标 | 是否需要服务器 | 适合场景 |
| --- | --- | --- | --- |
| Cloudflare Worker + KV | 可以，含地图选点 | 不需要 | 免费、轻量、推荐 |
| 阿里云 FC | 可以，含地图选点 | 不需要管理服务器 | 国内访问、函数计算 |
| GitHub Pages 静态源码 | 页面可选点生成 JSON | 不需要 | 仅作为源码示例，不自动部署 |
| Node 服务 | 可以，含地图选点 | 需要 | VPS、NAS |
| Docker 容器 | 可以，含地图选点 | 需要容器平台 | Render、Railway 等 |

## Shadowrocket 参数

在 `ios-mock-location.sgmodule` 里填写：

```text
configUrl=https://your-domain.example/loc.json?token=your-token
```

如果 `configUrl` 为空，脚本会使用模块里本地填写的 `latitude`、`longitude`、`altitude` 等参数。

## 1. Cloudflare Worker

```bash
cd deploy/cloudflare-worker
npm install
npx wrangler kv namespace create LOCATION_KV
npx wrangler kv namespace create LOCATION_KV --preview
```

把输出的 `id` 和 `preview_id` 填进 `wrangler.jsonc`。

设置 token：

```bash
npx wrangler secret put TOKEN
```

本地开发：

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

部署：

```bash
npm run deploy
```

部署后的 Shadowrocket 参数：

```text
configUrl=https://你的-worker.workers.dev/loc.json?token=你的TOKEN
```

管理页面：

```text
https://你的-worker.workers.dev/?token=你的TOKEN
```

管理页面支持高德地图 / 国外地图切换、点击选点、拖动标记、修改海拔和精度。

## 2. 阿里云 FC

FC 部署文件在：

```text
deploy/aliyun-fc/
```

推荐使用 Custom Runtime / Web Function。启动命令：

```text
sh /code/deploy/aliyun-fc/bootstrap
```

监听端口：

```text
9000
```

环境变量：

```text
TOKEN=replace-with-a-long-random-token
PORT=9000
DATA_FILE=/mnt/auto/ios-mock-location/loc.json
```

正式使用建议挂载 NAS，并把 `DATA_FILE` 指向 NAS 路径；如果使用 `/tmp`，实例回收后坐标可能丢失。

HTTP 触发器需要允许 `GET`、`POST`、`OPTIONS`，鉴权方式必须设置为：

```text
不鉴权 / anonymous
```

部署成功后：

```text
管理页面：https://你的-fc-域名/?token=你的TOKEN
configUrl=https://你的-fc-域名/loc.json?token=你的TOKEN
```

详细说明见：

[deploy/aliyun-fc/README.md](../deploy/aliyun-fc/README.md)

## 3. GitHub Pages

GitHub Pages 是静态站点，不能安全地在网页里直接保存坐标。本仓库只保留静态源码示例，不再自动部署 Pages。

目录：

```text
deploy/github-pages/
```

如果你手动把这个目录部署到静态托管，JSON 地址类似：

```text
https://你的用户名.github.io/ios-mock-location/loc.json
```

Shadowrocket 参数：

```text
configUrl=https://你的用户名.github.io/ios-mock-location/loc.json
```

注意：这个 `loc.json` 是公开的，不要把 token 或私密信息放进去。

## 4. Node 服务

适合普通 VPS、NAS。

```bash
git clone https://github.com/你的用户名/ios-mock-location.git
cd ios-mock-location
TOKEN=$(openssl rand -hex 24) PORT=8080 node picker/server.js
```

反向代理到 HTTPS 后的 Shadowrocket 参数：

```text
configUrl=https://你的域名/loc.json?token=你的TOKEN
```

管理页面：

```text
https://你的域名/?token=你的TOKEN
```

管理页面支持高德地图 / 国外地图切换、点击选点、拖动标记、修改海拔和精度。

## 5. Docker

构建：

```bash
docker build -t ios-mock-location .
```

运行：

```bash
docker run -d \
  --name ios-mock-location \
  -p 8080:8080 \
  -e TOKEN=replace-with-a-long-random-token \
  -v ios-mock-location-data:/data \
  ios-mock-location
```

如果你要部署到阿里云，优先看上面的 FC 方案；Docker 方案主要给其它容器平台或自有服务器使用。

健康检查：

```text
GET /health
```

坐标接口：

```text
GET /loc.json?token=你的TOKEN
POST /set?token=你的TOKEN
```
