#!/usr/bin/env bash
# SeanBlog Frame 一键安装 / 升级脚本。
#
# 用法（任意空目录执行即可）：
#   curl -fsSL https://raw.githubusercontent.com/SeanDictionary/SeanBlog-Frame/main/install.sh | bash
# 或本地：
#   bash install.sh
#
# 行为：
#   - 检查 docker / docker compose / curl
#   - 当前目录无 docker-compose.yml 时自动从仓库下载
#   - 拉取最新镜像并启动（幂等：已部署时等同升级）
#   - 等待 /api/health 就绪后，从启动日志抓取并打印首次管理员密码
#   - 已部署（管理员已存在）时提示重置命令，不打印密码

set -euo pipefail

REPO="SeanDictionary/SeanBlog-Frame"
RAW="https://raw.githubusercontent.com/$REPO/main"
COMPOSE_FILE="docker-compose.yml"
HEALTH_URL="http://127.0.0.1:3000/api/health"
HEALTH_TIMEOUT=180   # 等待应用就绪的最长秒数

c_bold=$'\033[1m'; c_green=$'\033[32m'; c_yellow=$'\033[33m'; c_red=$'\033[31m'; c_reset=$'\033[0m'
[ -t 1 ] || { c_bold=''; c_green=''; c_yellow=''; c_red=''; c_reset=''; }

log() { printf '%s==>%s %s\n' "$c_bold" "$c_reset" "$*"; }
warn() { printf '%s!!%s %s\n' "$c_yellow" "$c_reset" "$*"; }
die() { printf '%s!!%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }

# --- 1. 依赖检查 ---
command -v docker >/dev/null 2>&1 || die "未检测到 docker，请先安装 Docker。"
docker compose version >/dev/null 2>&1 || die "未检测到 docker compose 子命令，需 Docker Compose v2。"
command -v curl >/dev/null 2>&1 || die "未检测到 curl，请先安装。"

# --- 2. 准备 compose 文件 ---
if [ -f "$COMPOSE_FILE" ]; then
  log "使用当前目录已存在的 $COMPOSE_FILE"
else
  log "当前目录无 $COMPOSE_FILE，从仓库下载"
  curl -fsSL "$RAW/$COMPOSE_FILE" -o "$COMPOSE_FILE"
fi

# --- 3. 拉取镜像并启动 ---
log "拉取镜像并启动（首次部署会下载镜像，耗时较长）"
if ! docker compose pull; then
  warn "拉取镜像失败（可能离线或网络受限），尝试用本地已有镜像启动"
fi
docker compose up -d

# --- 4. 等待应用就绪 ---
log "等待应用就绪（最长 ${HEALTH_TIMEOUT}s）"
elapsed=0
ready=0
while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -sf "$HEALTH_URL" -o /dev/null 2>&1; then ready=1; break; fi
  sleep 1
  elapsed=$((elapsed + 1))
  [ $((elapsed % 10)) -eq 0 ] && printf '  已等待 %ss...\n' "$elapsed"
done
if [ "$ready" -ne 1 ]; then
  die "应用未在时限内就绪。查看日志：docker compose logs app"
fi

# --- 5. 抓取并打印首次管理员密码 ---
# initialize-admin 仅在首次创建管理员时把密码打到 app 容器 stdout；之后不再输出。
pw=$(docker compose logs app 2>/dev/null | grep -E 'Password:' | tail -1 | awk '{print $NF}' || true)

echo ""
printf '%s================== SeanBlog Frame ==================%s\n' "$c_green" "$c_reset"
if [ -n "$pw" ]; then
  printf '管理员账号已创建（%s仅本次显示，请立即保存%s）：\n' "$c_bold" "$c_reset"
  printf '  用户名：admin\n'
  printf '  密码 ：%s\n' "$pw"
else
  printf '管理员账号已存在（首次安装时已输出密码，无法再次查看）。\n'
  printf '  如需重置：docker compose exec app node scripts/reset-admin-password.mjs\n'
fi
printf '\n'
printf '后台地址：http://localhost:3000/admin （本机）\n'
printf '          http://<服务器IP>:3000/admin （远程）\n'
printf '\n'
printf '下一步：登录后台「站点信息」设置真实域名（如 https://blog.example.com），保存即生效。\n'
printf '\n'
printf '常用命令：\n'
printf '  实时日志：docker compose logs -f app\n'
printf '  升级    ：bash install.sh   （或 docker compose pull && docker compose up -d）\n'
printf '%s====================================================%s\n' "$c_green" "$c_reset"
