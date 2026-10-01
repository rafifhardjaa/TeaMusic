# THE Vibe LAB — API image.
#
# The build context is the repository root, not this directory, because the
# lockfile and the source both live under apps/ and Docker resolves every COPY
# against the context:
#
#   docker build -f apps/api/Dockerfile .
#
# Koyeb reads EXPOSE to learn which port to route to. The process binds
# 0.0.0.0:$PORT (default 8787) inside src/index.ts, and the free instance
# scales to zero when idle, so there is nothing else to keep warm.

FROM oven/bun:1.4-alpine AS deps

WORKDIR /app

# Manifest and lock first, on their own: copying the source above them would
# invalidate this layer on every commit and reinstall dependencies each build.
COPY apps/api/package.json apps/api/bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.4-alpine

WORKDIR /app

# Nothing in this process holds a secret. iTunes needs no key, messages travel
# browser -> Supabase directly, and ALLOWED_ORIGIN is supplied by the platform.
# Copying no .env file is deliberate: Bun auto-loads one from the working
# directory, and a baked-in localhost value would silently disable CORS.
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/package.json ./
COPY apps/api/src ./src

EXPOSE 8787

USER bun

CMD ["bun", "run", "start"]
