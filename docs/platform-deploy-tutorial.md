# 平台部署教程

这份教程只围绕当前项目实际支持的平台写：

- Shadowrocket 负责拦截和改写定位响应
- 云端服务只负责提供地图管理页和 `loc.json`
- 推荐优先部署到阿里云 FC 或 Cloudflare Worker

最终 Shadowrocket 只需要拿到一个地址：

```text
configUrl=https://你的域名/loc.json?token=你的TOKEN
```

远程 JSON 返回格式必须是：

```json
{"latitude":34.995447197649185,"longitude":127.16037938135219,"altitude":4,"horizontalAccuracy":39,"verticalAccuracy":1000}
```

## 部署前准备

先准备一个随机 token：

```bash
openssl rand -hex 24
```

如果在 Windows PowerShell 里没有 `openssl`，可以先临时写一个长随机字符串，例如：

```text
local-test-token-change-me-please
```

下面教程里统一写成：

```text
你的TOKEN
```

## 方案一：阿里云 FC

适合国内访问。当前项目已经准备好 FC 部署目录：

```text
deploy/aliyun-fc/
```

### 本次实操记录

本次控制台页面使用的是：

```text
https://fcnext.console.aliyun.com/overview
```

实际进入后选择的地域是：

```text
华东1（杭州） cn-hangzhou
```

本次创建的函数配置如下：

```text
函数类型：Web 函数
函数名称：ios-mock-location
运行环境：自定义运行时 / Linux / Debian 10
代码上传方式：通过 ZIP 包上传代码
上传文件：dist/ios-mock-location-fc.zip
启动命令：sh /code/deploy/aliyun-fc/bootstrap
监听端口：9000
执行超时时间：60 秒
最小实例数：0
单实例并发度：20
```

环境变量使用 JSON 格式编辑，内容是：

```json
{
  "TOKEN": "你的TOKEN",
  "PORT": "9000",
  "DATA_FILE": "/tmp/ios-mock-location/loc.json"
}
```

创建函数后还要检查 HTTP 触发器。触发器鉴权必须改成：

```text
不鉴权 / anonymous
```

如果 HTTP 触发器保持“需要鉴权”，浏览器访问管理页面和 `/loc.json` 时会先被阿里云拦住，Shadowrocket 也拿不到 JSON。

### 控制台部署步骤

#### 1. 生成 token

在项目根目录执行：

```powershell
$bytes = New-Object byte[] 24
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
Set-Content -Path .aliyun-fc-local-token.txt -Value $token -Encoding ASCII
$token.Length
```

正确输出：

```text
48
```

`.aliyun-fc-local-token.txt` 已加入 `.gitignore`，不要提交到 GitHub。

#### 2. 生成 ZIP 包

在项目根目录执行：

```powershell
$pkgDir = Join-Path $PWD 'dist'
$pkg = Join-Path $pkgDir 'ios-mock-location-fc.zip'
if (!(Test-Path $pkgDir)) { New-Item -ItemType Directory -Path $pkgDir | Out-Null }
if (Test-Path $pkg) { Remove-Item -LiteralPath $pkg }
$items = @('.editorconfig','.gitignore','Dockerfile','README.md','config','deploy','docs','ios-mock-location.js','ios-mock-location.sgmodule','package.json','picker','test','tools')
Compress-Archive -Path $items -DestinationPath $pkg -Force
Get-Item $pkg
```

本次生成的文件是：

```text
C:\Users\15615\Desktop\ios-mock-location\dist\ios-mock-location-fc.zip
```

#### 3. 进入函数计算控制台

浏览器打开：

```text
https://fcnext.console.aliyun.com/overview
```

左侧进入：

```text
函数管理 -> 函数列表
```

确认顶部地域是：

```text
华东1（杭州）
```

点击：

```text
创建函数
```

#### 4. 填写基础配置

页面标题是：

```text
创建 Web 函数
```

填写：

```text
函数名称：ios-mock-location
```

弹性配置填写：

```text
最小实例数：0
单实例并发度：20
```

最小实例数设为 `0` 可以减少空闲费用；首次访问可能会有冷启动。

#### 5. 填写函数代码

运行环境保持：

```text
自定义运行时 / Linux / Debian 10
```

代码上传方式选择：

```text
通过 ZIP 包上传代码
```

上传：

```text
dist/ios-mock-location-fc.zip
```

启动命令选择命令模式，填写：

```text
sh /code/deploy/aliyun-fc/bootstrap
```

监听端口填写：

```text
9000
```

执行超时时间保持：

```text
60
```

#### 6. 填写环境变量

展开：

```text
高级配置 -> 更多配置 -> 环境变量
```

选择：

```text
使用 JSON 格式编辑
```

把下面内容粘贴进去：

```json
{
  "TOKEN": "你的TOKEN",
  "PORT": "9000",
  "DATA_FILE": "/tmp/ios-mock-location/loc.json"
}
```

其中 `你的TOKEN` 使用 `.aliyun-fc-local-token.txt` 里的值。

#### 7. 创建函数

点击页面左下角：

```text
创建
```

如果页面提示确认创建，按提示确认。

创建完成后进入函数详情页。

#### 8. 修改 HTTP 触发器鉴权

在函数详情页找到：

```text
触发器管理
```

找到 HTTP 触发器，检查鉴权方式。如果显示需要鉴权，编辑触发器，把鉴权方式改成：

```text
不鉴权
```

控制台或配置里对应值通常是：

```text
anonymous
```

HTTP 方法需要包含：

```text
GET
POST
OPTIONS
```

保存触发器配置。

#### 9. 获取公网访问地址

在触发器详情或函数详情里复制 HTTP 触发器公网地址。地址通常类似：

```text
https://xxxx.cn-hangzhou.fcapp.run
```

管理页面：

```text
https://xxxx.cn-hangzhou.fcapp.run/?token=你的TOKEN
```

Shadowrocket `configUrl`：

```text
https://xxxx.cn-hangzhou.fcapp.run/loc.json?token=你的TOKEN
```

#### 10. 验证

浏览器打开管理页面：

```text
https://xxxx.cn-hangzhou.fcapp.run/?token=你的TOKEN
```

保存一个坐标后，再打开：

```text
https://xxxx.cn-hangzhou.fcapp.run/loc.json?token=你的TOKEN
```

应该看到五字段 JSON：

```json
{"latitude":34.995447197649185,"longitude":127.16037938135219,"altitude":4,"horizontalAccuracy":39,"verticalAccuracy":1000}
```

### Serverless Devs 部署

```yaml
region: cn-hangzhou
functionName: ios-mock-location
runtime: custom
customRuntimeConfig:
  command:
    - sh
  args:
    - /code/deploy/aliyun-fc/bootstrap
  port: 9000
environmentVariables:
  TOKEN: replace-with-a-long-random-token
  PORT: "9000"
  DATA_FILE: /tmp/ios-mock-location/loc.json
```

把 `TOKEN` 改成你自己的 token。

如果只是测试，可以先用：

```text
DATA_FILE=/tmp/ios-mock-location/loc.json
```

正式长期使用建议挂载 NAS，然后改成类似：

```text
DATA_FILE=/mnt/auto/ios-mock-location/loc.json
```

原因：`/tmp` 不适合长期保存配置，实例回收后坐标可能丢失。

#### 确认启动脚本

FC 启动脚本在：

```text
deploy/aliyun-fc/bootstrap
```

内容是：

```sh
#!/usr/bin/env sh
set -eu

export PORT="${PORT:-${FC_SERVER_PORT:-9000}}"
export DATA_FILE="${DATA_FILE:-/tmp/ios-mock-location/loc.json}"

exec node picker/server.js
```

如果你在 Linux/macOS 上部署，先给它可执行权限：

```bash
chmod +x deploy/aliyun-fc/bootstrap
```

#### 使用 Serverless Devs 部署

在项目根目录外或任意目录先确认 Serverless Devs 已登录你的阿里云账号。

进入 FC 配置目录：

```bash
cd deploy/aliyun-fc
```

部署：

```bash
s deploy
```

部署完成后，命令行会输出 HTTP 触发器地址。假设地址是：

```text
https://abc.example.cn-hangzhou.fcapp.run
```

那么管理页面是：

```text
https://abc.example.cn-hangzhou.fcapp.run/?token=你的TOKEN
```

Shadowrocket `configUrl` 是：

```text
https://abc.example.cn-hangzhou.fcapp.run/loc.json?token=你的TOKEN
```

### FC 验证

浏览器打开：

```text
https://你的-fc-域名/?token=你的TOKEN
```

保存一个坐标后，再打开：

```text
https://你的-fc-域名/loc.json?token=你的TOKEN
```

应该看到五字段 JSON：

```json
{"latitude":34.995447197649185,"longitude":127.16037938135219,"altitude":4,"horizontalAccuracy":39,"verticalAccuracy":1000}
```

## 方案二：Cloudflare Worker + KV

适合海外访问，部署简单。当前项目已经准备好 Worker 目录：

```text
deploy/cloudflare-worker/
```

### 本次实操结果

```text
Cloudflare Account: xiguac
Account ID: a1d3be0158f5504b7888311442b269c9
Worker: ios-mock-location
Worker URL: https://ios-mock-location.xiguac.workers.dev
KV binding: LOCATION_KV
KV id: df4faf4338a3484b875b3fa110963542
Preview KV id: 60ea5fd752ba4d73accbff92cd7ebf5f
```

token 已写入 Cloudflare Worker 的 `TOKEN` secret。本地备份文件是：

```text
.cloudflare-local-token.txt
```

这个文件已加入 `.gitignore`，不要提交到 GitHub。

本次生成的线上地址格式如下：

```text
管理页面：https://ios-mock-location.xiguac.workers.dev/?token=你的TOKEN
JSON 地址：https://ios-mock-location.xiguac.workers.dev/loc.json?token=你的TOKEN
Shadowrocket configUrl：https://ios-mock-location.xiguac.workers.dev/loc.json?token=你的TOKEN
```

### 本次实际执行的命令

以下命令是在 Windows PowerShell 中执行的，工作目录是：

```powershell
C:\Users\15615\Desktop\ios-mock-location\deploy\cloudflare-worker
```

#### 1. 确认 Wrangler 登录账号

```powershell
npx wrangler whoami
```

关键输出：

```text
Account Name: xiguac
Account ID: a1d3be0158f5504b7888311442b269c9
Email: i@oa5.xyz
workers: write
workers_kv: write
workers_scripts: write
```

#### 2. 创建正式 KV namespace

```powershell
npx wrangler kv namespace create LOCATION_KV
```

关键输出：

```text
Creating namespace with title "LOCATION_KV"
Success!
"binding": "LOCATION_KV"
"id": "df4faf4338a3484b875b3fa110963542"
```

#### 3. 创建 preview KV namespace

```powershell
npx wrangler kv namespace create LOCATION_KV --preview
```

关键输出：

```text
Creating namespace with title "LOCATION_KV_preview"
Success!
"binding": "LOCATION_KV"
"preview_id": "60ea5fd752ba4d73accbff92cd7ebf5f"
```

#### 4. 写入 `wrangler.jsonc`

文件：

```text
deploy/cloudflare-worker/wrangler.jsonc
```

当前内容应包含：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ios-mock-location",
  "main": "src/index.js",
  "compatibility_date": "2026-07-04",
  "kv_namespaces": [
    {
      "binding": "LOCATION_KV",
      "id": "df4faf4338a3484b875b3fa110963542",
      "preview_id": "60ea5fd752ba4d73accbff92cd7ebf5f"
    }
  ]
}
```

#### 5. 生成 48 位 token

```powershell
$bytes = New-Object byte[] 24
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
Set-Content -Path ..\..\.cloudflare-local-token.txt -Value $token -Encoding ASCII
```

验证长度：

```powershell
$token.Length
```

应该输出：

```text
48
```

#### 6. 写入 Cloudflare Worker secret

```powershell
$token | npx wrangler secret put TOKEN
```

第一次执行时，因为 Worker 还不存在，Wrangler 会提示并自动创建：

```text
There doesn't seem to be a Worker called "ios-mock-location".
Do you want to create a new Worker with that name and add secrets to it?
Using fallback value in non-interactive context: yes
Creating new Worker "ios-mock-location"...
Success! Uploaded secret TOKEN
```

后续再次执行时输出类似：

```text
Creating the secret for the Worker "ios-mock-location"
Success! Uploaded secret TOKEN
```

#### 7. 部署 Worker

```powershell
npx wrangler deploy
```

关键输出：

```text
Your Worker has access to the following bindings:
env.LOCATION_KV (df4faf4338a3484b875b3fa110963542) KV Namespace

Uploaded ios-mock-location
Deployed ios-mock-location triggers
https://ios-mock-location.xiguac.workers.dev
```

#### 8. 验证管理页面和 JSON

```powershell
$token = Get-Content ..\..\.cloudflare-local-token.txt
$base = 'https://ios-mock-location.xiguac.workers.dev'
$page = Invoke-WebRequest -Uri "$base/?token=$token" -UseBasicParsing -TimeoutSec 30
$json = Invoke-WebRequest -Uri "$base/loc.json?token=$token" -UseBasicParsing -TimeoutSec 30
$page.StatusCode
$json.StatusCode
$json.Content
```

正确结果：

```text
200
200
{"latitude":37.3349,"longitude":-122.00902,"altitude":530,"horizontalAccuracy":39,"verticalAccuracy":1000}
```

#### 9. 查看部署记录

```powershell
npx wrangler deployments list
```

能看到 `ios-mock-location` 的部署记录，说明 Worker 已经上线。

### 给其他用户复用的 Cloudflare 步骤

Cloudflare 当前推荐使用 Wrangler 管理 Worker。KV namespace 可以通过 Wrangler 创建，也可以在 Dashboard 的 Workers & Pages 里给 Worker 添加 KV Binding。

#### 1. 安装依赖

```bash
cd deploy/cloudflare-worker
npm install
```

#### 2. 登录 Cloudflare

```bash
npx wrangler login
```

登录后确认账号：

```bash
npx wrangler whoami
```

#### 3. 创建 KV

创建正式 KV：

```bash
npx wrangler kv namespace create LOCATION_KV
```

创建预览 KV：

```bash
npx wrangler kv namespace create LOCATION_KV --preview
```

命令会输出类似：

```json
{
  "binding": "LOCATION_KV",
  "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

把输出写入：

```text
deploy/cloudflare-worker/wrangler.jsonc
```

对应位置：

```jsonc
"kv_namespaces": [
  {
    "binding": "LOCATION_KV",
    "id": "正式 KV id",
    "preview_id": "预览 KV id"
  }
]
```

#### 4. 设置 TOKEN

```bash
npx wrangler secret put TOKEN
```

按提示输入你的 token。

本地开发可以复制：

```bash
cp .dev.vars.example .dev.vars
```

然后编辑 `.dev.vars`：

```text
TOKEN=你的TOKEN
```

#### 5. 本地预览

```bash
npm run dev
```

打开 Wrangler 输出的本地地址，例如：

```text
http://127.0.0.1:8787/?token=你的TOKEN
```

JSON 地址：

```text
http://127.0.0.1:8787/loc.json?token=你的TOKEN
```

#### 6. 部署 Worker

```bash
npm run deploy
```

部署完成后会得到类似：

```text
https://ios-mock-location.你的账号.workers.dev
```

管理页面：

```text
https://ios-mock-location.你的账号.workers.dev/?token=你的TOKEN
```

Shadowrocket `configUrl`：

```text
https://ios-mock-location.你的账号.workers.dev/loc.json?token=你的TOKEN
```

#### 7. Cloudflare 控制台绑定 KV

如果你选择在网页控制台手动绑定 KV：

1. 进入 Cloudflare Dashboard。
2. 打开 Workers & Pages。
3. 选择你的 Worker。
4. 进入 Settings。
5. 打开 Bindings。
6. Add binding，类型选择 KV Namespace。
7. 变量名填写：

```text
LOCATION_KV
```

8. 选择对应的 KV namespace。
9. 保存并重新部署。

## 方案三：GitHub Pages 静态源码

适合只保留公开静态示例的情况。本仓库现在只上传源码，不自动部署 GitHub Pages。

限制：GitHub Pages 是静态站点，页面可以地图选点并生成 JSON，但不能直接保存到服务器。

静态示例目录：

```text
deploy/github-pages/
```

如果你以后手动部署这个目录，JSON 地址类似：

```text
https://你的用户名.github.io/ios-mock-location/loc.json
```

Shadowrocket `configUrl`：

```text
https://你的用户名.github.io/ios-mock-location/loc.json
```

## 方案四：Node 本地或 VPS

适合本地测试、NAS、VPS。

```bash
TOKEN=你的TOKEN PORT=8080 node picker/server.js
```

管理页面：

```text
http://服务器IP:8080/?token=你的TOKEN
```

JSON 地址：

```text
http://服务器IP:8080/loc.json?token=你的TOKEN
```

如果给 Shadowrocket 长期使用，请放到 HTTPS 后面，例如用 Nginx/Caddy 做反代。

## 方案五：Docker

构建：

```bash
docker build -t ios-mock-location .
```

运行：

```bash
docker run -d \
  --name ios-mock-location \
  -p 8080:8080 \
  -e TOKEN=你的TOKEN \
  -v ios-mock-location-data:/data \
  ios-mock-location
```

管理页面：

```text
http://服务器IP:8080/?token=你的TOKEN
```

JSON 地址：

```text
http://服务器IP:8080/loc.json?token=你的TOKEN
```

## 接入 Shadowrocket

部署完成后，把最终 JSON 地址填入 Shadowrocket 模块参数：

```text
configUrl=https://你的域名/loc.json?token=你的TOKEN
```

然后：

1. 确认 Shadowrocket MITM 已开启。
2. 确认 CA 证书已安装并信任。
3. 确认 `ios-mock-location.sgmodule` 已启用。
4. 断开并重新连接代理/VPN。
5. 打开地图 App 验证。

## 排查

### 管理页面能打开，但 JSON 403

检查 token 是否一致。

### JSON 能打开，但 Shadowrocket 不生效

检查：

- MITM 是否开启
- CA 是否信任
- 模块是否启用
- `script-path` 是否能访问
- `configUrl` 是否能在浏览器打开

### 阿里云 FC 保存后坐标丢失

大概率是 `DATA_FILE` 放在 `/tmp`，实例回收后文件丢失。正式使用请挂 NAS。

### Cloudflare Worker 保存失败

检查：

- KV namespace 是否创建
- `wrangler.jsonc` 里的 `id` / `preview_id` 是否正确
- Worker Binding 名是否是 `LOCATION_KV`
- `TOKEN` secret 是否设置

## 参考链接

- Cloudflare Wrangler：<https://developers.cloudflare.com/workers/wrangler/>
- Cloudflare KV：<https://developers.cloudflare.com/kv/>
- Cloudflare KV bindings：<https://developers.cloudflare.com/kv/concepts/kv-bindings/>
- 阿里云 FC Custom Runtime：<https://www.alibabacloud.com/help/en/functioncompute/fc/principles-1>
- 阿里云 FC Custom Container：<https://www.alibabacloud.com/help/en/functioncompute/fc/user-guide/custom-container/>
