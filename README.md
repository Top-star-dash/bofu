# 博富·福美城 · 幸运抽奖 H5

Next.js 16 + Prisma 7 + PostgreSQL，包含移动端抽奖 H5 与后台管理。

## 本地启动

```bash
npm install
npx prisma migrate deploy      # 或 migrate dev
npm run db:seed                # 初始化管理员/活动/奖品
APP_ENV=TEST npm run dev       # 本地必须覆盖为 TEST，否则会强制走微信授权
```

- H5：<http://localhost:3000/>
- 后台：<http://localhost:3000/admin>（种子账号 `bofuadmin` / `bofuadminNsw1!`）

`APP_ENV=TEST` 时不校验微信身份，直接用 `dev_<时间戳>` 作为 openid，方便本地联调。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 连接串，`postgresql://user:pass@host:5432/db?schema=public` |
| `SESSION_SECRET` | 是 | 顾客/后台 JWT 与授权 state 的签名密钥 |
| `APP_ENV` | 是 | `PRODUCTION` 时启用微信授权；其他值视为联调 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 生产必填 | 公众号 AppID / AppSecret（服务号需有网页授权权限） |
| `PUBLIC_BASE_URL` | 建议 | 如 `https://bofu.gdruixiang.com`。反代后 `request.url` 是内网地址，配了它才能生成正确的回调域名 |
| `WECHAT_OAUTH_SCOPE` | 否 | 默认 `snsapi_userinfo`（取昵称头像）；填 `snsapi_base` 则静默授权不取资料 |

## 微信授权

```
用户打开 H5
  → 服务端检测无 bofu_customer_session 且 APP_ENV=PRODUCTION 且 UA 含 MicroMessenger
  → 302 /api/auth/wechat/start?r=/
  → 302 open.weixin.qq.com/connect/oauth2/authorize
  → 微信回调 /api/auth/wechat/callback?code&state
  → code 换 openid（+ snsapi_userinfo 取昵称头像）
  → ensureCustomer → 写 cookie → 302 回首页?wx=ok
```

- `state` 使用 `SESSION_SECRET` 做 HMAC 签名，10 分钟过期，防开放重定向。
- 授权失败会带 `wx=fail&reason=...` 回到首页（Toast 提示原因），**不挡浏览**，不会循环跳转。
- 未授权仍可看活动/楼盘；点击抽奖、留资或「我的奖品」时弹出可关闭的授权引导。
- **公众号后台需配置**：网页授权域名 = 站点域名；`/api/auth/wechat/callback` 挂在同域名下，无需单独配置。
- 非微信环境（PC 浏览器）不自动跳转，可浏览；抽奖时提示用微信打开。

## 后台功能

| 页面 | 路径 | 说明 |
|---|---|---|
| 数据概览 | `/admin` | 曝光、参与、留资、抽奖、中奖统计 |
| 核销台 | `/admin/redeem` | 核销码 + 核销密码查询，二次确认核销，记录核销人与操作日志 |
| 线索管理 | `/admin/leads` | 关键词/分层/顾问/日期筛选、分页、导出 CSV（带 BOM，Excel 直接打开） |
| 奖品 / 顾问 / 用户 | `/admin/*` | 现有管理页 |

核销接口：`POST /api/admin/redeem`，`action=query|confirm`，需 `redeem` 权限。
导出接口：`GET /api/admin/leads/export`，支持与列表一致的筛选参数，需 `leads` 权限。

## Apache 反向代理

Next 以 `next start -p 3007` 运行在 127.0.0.1，Apache 需保留 Host 并透传协议，否则微信回调域名会算错：

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
ProxyPass /uploads !
Alias /uploads/ /path/to/uploads/
ProxyPass / http://127.0.0.1:3007/
ProxyPassReverse / http://127.0.0.1:3007/
```

若不方便改反代头，直接设置 `PUBLIC_BASE_URL` 也可。

## 常用命令

```bash
npm run build          # prisma generate && next build
npm run lint
npm run db:seed
npx prisma migrate deploy
```
