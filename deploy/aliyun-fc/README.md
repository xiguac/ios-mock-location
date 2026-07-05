# 阿里云 FC 部署

这里的 FC 指阿里云函数计算。推荐使用 FC 3.0 的 Custom Runtime / Web Function 方式部署，本项目本身就是一个 HTTP Server。

完整逐步教程见：

```text
docs/platform-deploy-tutorial.md
```

## 关键配置

```text
函数类型：Web 函数
运行环境：自定义运行时 / Linux / Debian 10
启动命令：sh /code/deploy/aliyun-fc/bootstrap
监听端口：9000
执行超时时间：60 秒
最小实例数：0
单实例并发度：20
```

环境变量：

```json
{
  "TOKEN": "你的TOKEN",
  "PORT": "9000",
  "DATA_FILE": "/tmp/ios-mock-location/loc.json"
}
```

HTTP 触发器鉴权必须设置为：

```text
不鉴权 / anonymous
```

HTTP 方法需要包含：

```text
GET
POST
OPTIONS
```

## 控制台部署

1. 在项目根目录生成 token。
2. 打包 `dist/ios-mock-location-fc.zip`。
3. 打开函数计算 FC 控制台。
4. 创建 Web 函数。
5. 选择自定义运行时。
6. 代码上传方式选择“通过 ZIP 包上传代码”。
7. 上传 `dist/ios-mock-location-fc.zip`。
8. 启动命令填写 `sh /code/deploy/aliyun-fc/bootstrap`。
9. 监听端口填写 `9000`。
10. 环境变量使用 JSON 格式编辑，填入 `TOKEN`、`PORT`、`DATA_FILE`。
11. 创建函数。
12. 创建后检查 HTTP 触发器，把鉴权改成“不鉴权 / anonymous”。
13. 复制 HTTP 触发器公网地址。

管理页面：

```text
https://你的-fc-域名/?token=你的TOKEN
```

Shadowrocket `configUrl`：

```text
https://你的-fc-域名/loc.json?token=你的TOKEN
```

## Serverless Devs

当前目录的 `s.yaml` 已按 FC3 配置：

```yaml
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

部署：

```bash
cd deploy/aliyun-fc
s deploy
```

## 持久化说明

如果 `DATA_FILE` 使用 `/tmp/ios-mock-location/loc.json`，冷启动或实例回收后坐标可能丢失。

正式长期使用建议给 FC 挂载 NAS，并把 `DATA_FILE` 改成 NAS 挂载目录，例如：

```text
DATA_FILE=/mnt/auto/ios-mock-location/loc.json
```

## 参考

- https://www.alibabacloud.com/help/en/functioncompute/fc/principles-1
- https://www.alibabacloud.com/help/en/functioncompute/fc/user-guide/custom-container/
