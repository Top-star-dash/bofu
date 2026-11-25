#!/usr/bin/env bash
#
# 博富·福美城 H5 —— 通过 SFTP 把代码上传到 RX 的 /mnt/data/html/bofu
#
#   ./scripts/deploy-sftp.sh            上传 + 服务器 npm ci + prisma generate + build + pm2 重启
#   ./scripts/deploy-sftp.sh --install  上传 + npm ci（不构建、不重启）
#   ./scripts/deploy-sftp.sh --upload   只上传代码
#   ./scripts/deploy-sftp.sh --env      额外强制覆盖服务器上的 .env
#
# 首次部署时若服务器没有 .env，会自动把本地 .env 传上去；之后不再覆盖。
set -euo pipefail

HOST="${DEPLOY_HOST:-RX}"                 # ~/.ssh/config 里的 Host
REMOTE_DIR="${DEPLOY_DIR:-/mnt/data/html/bofu}"
APP_NAME="${DEPLOY_APP:-bofu}"
APP_PORT="${DEPLOY_PORT:-3007}"

MODE="full"
PUSH_ENV=0
for arg in "$@"; do
  case "$arg" in
    --upload)  MODE="upload" ;;
    --install) MODE="install" ;;
    --env)     PUSH_ENV=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "未知参数：$arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$ROOT/.deploy"
TARBALL="bofu-src.tar.gz"

mkdir -p "$STAGE"
rm -f "$STAGE/$TARBALL"

echo "▶ 打包源码（排除 node_modules / .next / .git / 素材原图 / .env）"
tar czf "$STAGE/$TARBALL" -C "$ROOT" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./.deploy' \
  --exclude='./.agents' \
  --exclude='./.claude' \
  --exclude='./.cursor' \
  --exclude='./.windsurf' \
  --exclude='./图片' \
  --exclude='./楼盘图片' \
  --exclude='./资料' \
  --exclude='./别的公司抽奖活动参考页面' \
  --exclude='./logs' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  --exclude='*.tsbuildinfo' \
  .
echo "  包大小：$(du -h "$STAGE/$TARBALL" | cut -f1)"

# Windows 版 sftp 不认 MSYS 路径，也不支持 mkdir -p，所以目录用 ssh 建、文件用 sftp 传
STAGE_WIN="$(cygpath -m "$STAGE" 2>/dev/null || printf '%s' "$STAGE")"
ROOT_WIN="$(cygpath -m "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"

echo "▶ 准备远端目录 $REMOTE_DIR"
ssh "$HOST" "mkdir -p '$REMOTE_DIR/.incoming'"

echo "▶ SFTP 上传"
printf 'lcd %s\nput %s %s/.incoming/src.tar.gz\n' \
  "$STAGE_WIN" "$TARBALL" "$REMOTE_DIR" > "$STAGE/sftp.batch"
sftp -b "$STAGE/sftp.batch" "$HOST" > /dev/null
echo "  上传完成"

# .env：服务器上没有就补一份，避免首次部署起不来
if [ "$PUSH_ENV" = "1" ] || ! ssh "$HOST" "test -f '$REMOTE_DIR/.env'"; then
  if [ ! -f "$ROOT/.env" ]; then
    echo "  !! 本地没有 .env，跳过环境变量上传" >&2
  else
    echo "▶ 上传 .env"
    printf 'lcd %s\nput .env %s/.env\n' "$ROOT_WIN" "$REMOTE_DIR" > "$STAGE/sftp-env.batch"
    sftp -b "$STAGE/sftp-env.batch" "$HOST" > /dev/null
  fi
fi

if [ "$MODE" = "upload" ]; then
  ssh "$HOST" "cd '$REMOTE_DIR' && tar xzf .incoming/src.tar.gz && rm -rf .incoming && ls -1 | head -20"
  echo "✔ 代码已上传到 $HOST:$REMOTE_DIR（未安装依赖、未重启服务）"
  exit 0
fi

echo "▶ 服务器解包"
ssh "$HOST" "cd '$REMOTE_DIR' && tar xzf .incoming/src.tar.gz && rm -rf .incoming"

echo "▶ 安装依赖 + 生成 Prisma Client"
ssh "$HOST" "cd '$REMOTE_DIR' && npm ci --no-audit --no-fund && npx prisma generate"

if [ "$MODE" = "install" ]; then
  echo "✔ 依赖与 Prisma Client 就绪（未构建、未重启服务）"
  exit 0
fi

echo "▶ 构建"
ssh "$HOST" "cd '$REMOTE_DIR' && npm run build"

echo "▶ 重启 pm2（$APP_NAME → 127.0.0.1:$APP_PORT）"
ssh "$HOST" "cd '$REMOTE_DIR' && mkdir -p logs && { pm2 describe '$APP_NAME' >/dev/null 2>&1 && pm2 restart '$APP_NAME' --update-env || pm2 start ecosystem.config.cjs; } && pm2 save"

echo "✔ 部署完成：$HOST:$REMOTE_DIR"
