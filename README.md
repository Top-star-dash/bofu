# 博富·福美城 · 幸运抽奖 H5

Next.js 16 + Prisma 7 + MySQL，包含移动端抽奖 H5 与后台管理。

> **Agent / 新人入口**：[知识索引.md](./知识索引.md)（文档地图、目录入口、业务链路、易踩坑约定）。

## 本地启动

```bash
npm install
npm run db:push                # 按 schema 建表（本项目未用 migrations）
npm run db:seed                # 初始化管理员/活动/奖品
APP_ENV=TEST npm run dev       # 本地必须覆盖为 TEST，否则会强制走微信授权
```

- H5：<http://localhost:3000/>
- 后台：<http://localhost:3000/admin>（种子账号 `bofuadmin` / `bofuadminNsw1!`）

`APP_ENV=TEST` 时不校验微信身份，直接用 `dev_<时间戳>` 作为 openid，方便本地联调。

本地若出现 `pool failed to retrieve a connection` / `45028`：多半是库不存在或账号无权限。用 root 建库并授权后再 `npm run db:push && npm run db:seed`：

```sql
CREATE DATABASE IF NOT EXISTS bofu_fumei_lottery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON bofu_fumei_lottery.* TO 'dev'@'localhost';
FLUSH PRIVILEGES;
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | MySQL 连接串，`mysql://user:pass@host:3306/db`（Prisma 走 `@prisma/adapter-mariadb`，兼容 MySQL 8 / MariaDB 10.11）。`src/lib/db.ts` 会自动打开 `allowPublicKeyRetrieval`，避免本地 MySQL 8 连不上 |
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
| 活动配置 | `/admin/settings` | 标题/时间/分享/地址外链/核销密码/次数规则/公告/规则文案 |
| 奖品管理 | `/admin/prizes` | 增删改、库存、概率（合计 100% 才可保存）、兜底奖 |
| 顾问管理 | `/admin/consultants` | CRUD、启停、默认顾问、二维码、Excel 批量导入 |
| 素材管理 | `/admin/assets` | Logo/KV/海报/转盘/楼盘资产上传与排序 |
| 线索管理 | `/admin/leads` | 筛选/分页/脱敏/导出 CSV；`/admin/leads/[id]` 详情含备注、分层、人工改绑、行为轨迹 |
| 核销台 | `/admin/redeem` | 核销码 + 核销密码查询，二次确认核销，记录核销人与操作日志 |
| 数据统计 | `/admin/stats` | 顾问维度漏斗与排行、库存预警、按日期筛选、xlsx 导出 |
| 用户权限 | `/admin/users` | 账号、权限模块、启停、重置密码 |

核销接口：`POST /api/admin/redeem`，`action=query|confirm`，需 `redeem` 权限。
导出接口：
- `GET /api/admin/leads/export`：线索 CSV（带 BOM），需 `leads` 权限。
- `GET /api/admin/export/sales`：销售推广转化汇总 xlsx，需 `stats` 权限。
- `GET /api/admin/export/prizes`：中奖兑奖明细 xlsx，支持 `from` / `to` / `consultant` / `status`，需 `stats` 权限。


## Apache 反向代理

Next 以 `next start -p 3007` 运行在 127.0.0.1，Apache 需保留 Host 并透传协议，否则微信回调域名会算错。线上实际配置（`/etc/apache2/sites-available/bofu-le-ssl.conf`）：

```apache
DocumentRoot /mnt/data/html/bofu/public
<Directory /mnt/data/html/bofu/public>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>

# 微信域名校验文件由 Apache 直出，不经过 Node
Alias /MP_verify_XXXX.txt /mnt/data/html/bofu/public/MP_verify_XXXX.txt
ProxyPass /MP_verify_XXXX.txt !

ProxyPreserveHost On
ProxyRequests Off
ProxyTimeout 60
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"
ProxyPass / http://127.0.0.1:3007/ retry=0
ProxyPassReverse / http://127.0.0.1:3007/
```

- 微信校验文件也放在 `public/`，Next 自己就会在站点根路径直出；Apache 那条 `Alias` 只是兜底（Node 挂了也能通过校验）。
- 若不方便改反代头，直接设置 `PUBLIC_BASE_URL` 也可。

## 常用命令

```bash
npm run build          # prisma generate && next build
npm run lint
npm run db:seed
npx prisma migrate deploy
npm run images:webp    # 把 public 下 jpg/png 批量转同名 webp（不删原图）
```

## 图片优化

- 后台 `/api/admin/upload` 上传的 jpg/png 统一输出 WebP（GIF 动图保留原格式），最长边 1600px、质量 80。
- 历史素材可执行 `npm run images:webp` 批量生成同名 `.webp`；代码会把 `/property`、`/activity`、`/uploads` 下的 jpg/png 自动指向同名 webp，数据库无需改字段。
- 原图保留作备份；确认不再需要后可自行清理，不影响站内引用。

## 部署（SFTP → RX）

代码放在 RX 的 `/mnt/data/html/bofu`（系统盘 `/var/www` 已用 96%，数据盘 `/mnt/data` 还剩 36G），pm2 以 `127.0.0.1:3007` 运行，Apache 反代 `bofu.gdruixiang.com`；启动参数见 `ecosystem.config.cjs`。

```bash
bash scripts/deploy-sftp.sh            # 上传 + npm ci + prisma generate + 迁移/db push + build + pm2 重启
bash scripts/deploy-sftp.sh --install  # 只到 npm ci，不构建不重启
bash scripts/deploy-sftp.sh --upload   # 只上传代码
bash scripts/deploy-sftp.sh --env      # 强制用本地 .env 覆盖服务器上的
```

脚本把源码打成约 30MB 的包（排除 `node_modules`、`.next`、`.git`、素材原图、`.env`），用 SFTP 传到 `/mnt/data/html/bofu/.incoming/src.tar.gz`，再 ssh 上去解包、装依赖、`prisma generate`、**同步表结构**、构建、重启 pm2。
服务器上首次没有 `.env` 时会自动补一份，之后不再覆盖，避免把线上配置冲掉。

> 表结构同步：仓库里有 `prisma/migrations/*/migration.sql` 时执行 **`prisma migrate deploy`**（只应用库里尚未记录的迁移）；没有迁移文件时回退 **`prisma db push`**。`prisma generate` 只生成客户端、不动表结构——少了同步这一步，新代码查新增字段会直接 `P2022 ColumnNotFound`（2026-11-25 线上全站 500 就是这个原因）。`db push` 不传 `--accept-data-loss`，需删列/收窄类型会失败并中止部署。

> Windows 版 sftp 不支持 `mkdir -p`，也不认 MSYS 路径，所以脚本里目录用 ssh 建、文件用 `lcd` + 相对路径传。

### 服务器数据库

RX 上跑的是 MariaDB 10.11（`127.0.0.1:3306`，只监听本机），库 `bofu_fumei_lottery`，账号用服务器既有的 `dev`：

```bash
# 建库（首次）
sudo mysql -e "CREATE DATABASE IF NOT EXISTS bofu_fumei_lottery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 建表 + 种子（无迁移文件时用 db push；有 migrations 则用 migrate deploy）
ssh RX "cd /mnt/data/html/bofu && npx prisma db push && npm run db:seed"
# 或：ssh RX "cd /mnt/data/html/bofu && npx prisma migrate deploy && npm run db:seed"
```

`.env` 里对应 `DATABASE_URL="mysql://dev:<密码>@127.0.0.1:3306/bofu_fumei_lottery"`。
改过 schema 后，本地用 `npm run db:migrate` 生成迁移文件并提交；`bash scripts/deploy-sftp.sh` 会自动 `migrate deploy`（无迁移则 `db push`）。手工部署时仍需自己跑同步，`npm run build` 里的 `prisma generate` 只重生成客户端、不动表结构。
