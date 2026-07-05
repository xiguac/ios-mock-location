# ios-mock-location

一个面向 Shadowrocket 的 iOS 定位模拟工具。它通过 MITM 拦截 Apple 定位接口 `/clls/wloc` 的响应，把返回中的 Wi-Fi 与蜂窝基站坐标改成你指定的位置。

> 仅用于自己设备、测试环境的学习研究。请勿用于绕过服务规则、欺诈及任何违法场景。

## 参考项目

本项目参考了 [mekos2772/ios-location-spoofer](https://github.com/mekos2772/ios-location-spoofer) 的产品思路与使用场景，包括代理脚本、远程坐标配置、地图选点等方向；代码与项目结构为重新实现。

## 它怎么工作

iPhone 会把附近 Wi-Fi、蜂窝基站等信息发给 Apple 定位服务，Apple 返回这些信号对应的大致坐标，系统再据此计算当前位置。

本项目做的事情是：

```text
iPhone 定位请求 -> Shadowrocket MITM 解密 -> 脚本改写 Apple 响应坐标 -> iOS 得到目标位置
```

## 功能

- 单文件代理响应脚本：`ios-mock-location.js`
- Shadowrocket 模块：`ios-mock-location.sgmodule`
- 支持 Wi-Fi 坐标与蜂窝基站坐标改写
- 支持远程 `configUrl`
- 支持地图选点
- 国内使用高德地图，国外使用 OpenStreetMap
- 高德地图使用 GCJ-02 展示，保存时自动转换为 Apple 需要的 WGS-84
- 支持修改海拔、水平精度、垂直精度
- 支持在线获取海拔
- 支持 Cloudflare Worker + KV 部署
- 支持阿里云 FC 部署
- 提供 GitHub Pages 静态示例源码
- 支持 Node / Docker 部署
- 带基础测试，验证 protobuf 坐标改写逻辑

## 文件说明

```text
ios-mock-location.js                 # Shadowrocket 加载的核心脚本
ios-mock-location.sgmodule           # Shadowrocket 模块
picker/server.js                     # Node 远程坐标服务和地图面板
picker/page.html                     # 地图选点 UI
deploy/aliyun-fc/                    # 阿里云 FC 部署
deploy/cloudflare-worker/            # Cloudflare Worker + KV 和地图面板
deploy/github-pages/                 # GitHub Pages 静态示例和 loc.json
tools/update-location.js             # 更新静态 loc.json 的脚本
config/default.json                  # 坐标配置模板
test/core.test.js                    # 基础改写测试
```

## 快速开始

### 1. 准备脚本地址

把仓库上传到你自己的 GitHub 后，把 `ios-mock-location.sgmodule` 里的 `script-path` 改成你的 raw 地址：

```text
https://raw.githubusercontent.com/你的用户名/ios-mock-location/main/ios-mock-location.js
```

### 2. 导入 Shadowrocket 模块

在 Shadowrocket 中导入：

```text
ios-mock-location.sgmodule
```

模块会匹配这些定位接口域名：

```text
gs-loc.apple.com
gs-loc-cn.apple.com
bluedot.is.autonavi.com
bluedot.is.autonavi.com.gds.alibabadns.com
```

### 3. 开启 MITM

在 Shadowrocket 中：

1. 开启 HTTPS 解密 / MITM。
2. 安装 CA 证书。
3. 到 iOS 设置中信任该 CA 证书。
4. 重新连接代理或 VPN。

### 4. 设置目标坐标

可以直接在模块参数里填写：

```text
latitude=39.9042&longitude=116.4074&horizontalAccuracy=39&verticalAccuracy=1000&altitude=50
```

也可以配置远程坐标：

```text
configUrl=https://your-domain.example/loc.json?token=replace-with-a-long-random-token
```

脚本会优先使用远程配置；远程读取失败时回退到模块里的本地参数。

### 5. 验证

断开并重新连接代理/VPN，重启 iOS 定位服务，然后打开地图 App 查看位置。

## 坐标参数

默认坐标是 Apple Park：

```text
latitude=37.3349
longitude=-122.00902
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `latitude` | `37.3349` | 目标纬度 |
| `longitude` | `-122.00902` | 目标经度 |
| `horizontalAccuracy` | `39` | 水平精度 |
| `verticalAccuracy` | `1000` | 垂直精度 |
| `altitude` | `530` | 海拔 |
| `failOpen` | `true` | 改写失败时放行原响应 |
| `debug` | `false` | 输出调试日志 |

远程 JSON 只包含坐标字段，格式如下：

```json
{"latitude":34.995447197649185,"longitude":127.16037938135219,"altitude":4,"horizontalAccuracy":39,"verticalAccuracy":1000}
```

## 地图选点

Node、Cloudflare Worker 和阿里云 FC 部署都带可保存的地图面板：

```text
https://your-domain.example/?token=replace-with-a-long-random-token
```

面板支持：

- 点击地图选点
- 拖动标记调整点位
- 高德地图 / 国外地图切换
- 手动修改经纬度
- 修改海拔、水平精度、垂直精度
- 在线获取海拔

GitHub Pages 目录只作为静态源码示例保留，仓库不会自动部署。页面可以地图选点并生成坐标值，但不能直接写入远端。

## 云端部署

详细说明见：

[docs/deployment.md](docs/deployment.md)

如果你要按平台一步步操作，见：

[docs/platform-deploy-tutorial.md](docs/platform-deploy-tutorial.md)

当前支持：

| 平台 | 在线保存坐标 | 说明 |
| --- | --- | --- |
| Cloudflare Worker + KV | 可以 | 轻量，适合海外访问 |
| 阿里云 FC | 可以 | 适合国内访问，建议挂 NAS 保存 `loc.json` |
| Node 服务 | 可以 | 适合 VPS / NAS |
| Docker | 可以 | 适合自有服务器或容器平台 |
| GitHub Pages 静态源码 | 不能直接保存 | 仅作为示例源码，不自动部署 |

## 本地测试

启动本地坐标服务：

```bash
TOKEN=local-test-token PORT=8080 node picker/server.js
```

管理页面：

```text
http://127.0.0.1:8080/?token=local-test-token
```

获取 JSON：

```text
http://127.0.0.1:8080/loc.json?token=local-test-token
```

接口：

- `GET /`：地图选点面板
- `GET /loc.json?token=...`：读取当前坐标配置
- `POST /set?token=...`：保存坐标配置
- `GET /health`：健康检查

## 常见问题

### 只装 CA 证书可以吗？

不可以。CA 证书只解决 HTTPS 解密的信任问题，真正改写定位响应需要 Shadowrocket 拦截请求并执行脚本。

### JSON 里为什么没有 `enabled`？

远程配置只保存坐标字段：

```json
{"latitude":34.995447197649185,"longitude":127.16037938135219,"altitude":4,"horizontalAccuracy":39,"verticalAccuracy":1000}
```

脚本是否启用由 Shadowrocket 模块参数控制，不写进远程 JSON。

### 高德地图选点会不会偏？

国内高德地图使用 GCJ-02 坐标展示。页面保存时会转换为 Apple 定位响应需要的 WGS-84 坐标。

### 修改位置后没有立刻生效？

可以尝试：

1. 确认 Shadowrocket MITM 已开启并信任证书。
2. 确认模块已启用。
3. 断开并重新连接代理/VPN。
4. 关闭再打开 iOS 定位服务。
5. 打开 `debug=true` 看 Shadowrocket 日志。

## 开发

```bash
npm test
```

项目没有运行时依赖。测试使用 Node.js 内置模块；地图页面通过 CDN 加载 Leaflet。

## 免责声明

本项目仅用于个人设备测试与学习研究。使用者需自行承担使用风险，并遵守所在地法律法规和相关服务条款。
