# syntax=docker/dockerfile:1
# ---- Builder ---------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PRISMA_TELEMETRY_DISABLED=1
COPY package.json package-lock.json prisma.config.ts tsconfig.json next.config.ts postcss.config.mjs next-env.d.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY .env.example ./.env.example
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY src ./src
COPY public ./public
# Generate Prisma Client (WASM query compiler, tanpa unduh native engine)
RUN bash scripts/prisma-generate.sh && npm run build

# ---- Runner ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PRISMA_TELEMETRY_DISABLED=1 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates bash \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package.json /app/package-lock.json /app/prisma.config.ts /app/tsconfig.json /app/next.config.ts /app/postcss.config.mjs ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/docker ./docker
COPY --from=builder /app/.env.example ./.env.example
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bash", "docker/entrypoint.sh"]
