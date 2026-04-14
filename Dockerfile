FROM node:20-slim AS build

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# Production deps only (separate layer for smaller final image)
RUN rm -rf node_modules && npm ci --omit=dev && npm cache clean --force

# Production stage
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    wget \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 libpixman-1-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/db.ts ./db.ts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
ENV PORT=3446
ENV DATA_DIR=/data
ENV WORKSPACE_DIR=/tmp/workspace

EXPOSE 3446

CMD ["node", "--import", "tsx", "server/index.ts"]
