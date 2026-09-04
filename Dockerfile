# 生产镜像：多阶段构建 Next.js（standalone 输出）。
# 仅在容器化部署时使用；本地开发不需要构建此镜像。

# 1. 安装依赖
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. 构建
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# content/ 在仓库中为运行时内容（gitignore），clone 后可能不存在；
# 此处保证 builder 镜像内存在该目录，避免 runner 阶段 COPY 失败。运行时由命名卷覆盖。
RUN mkdir -p /app/content
# 站点 URL（siteUrl）由后台设置（DB）运行时读取，不再需要构建期变量；
# 缺省 http://localhost:3000，管理员在后台配置真实域名后即时生效。
RUN npx prisma generate
RUN npm run build

# 3. 运行
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/content ./content
COPY --from=builder --chown=nextjs:nodejs /app/themes ./themes
COPY --from=builder --chown=nextjs:nodejs /app/themes/seanblog-default ./theme-seed/seanblog-default
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
RUN chmod +x ./scripts/start-production.sh
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# 用户上传内容存储根：脱离 public/（生产模式 public/ 文件清单在启动时缓存，
# 运行时写入的文件不会被服务）。挂命名卷以持久化，并预建属主为 nextjs，
# 使首次挂载时 Docker 将该属主复制进空卷，容器内可写（同 content/themes 卷套路）。
RUN mkdir -p /app/storage/uploads \
  && chown -R nextjs:nodejs /app/storage \
  && touch /app/storage/uploads/.gitkeep

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
