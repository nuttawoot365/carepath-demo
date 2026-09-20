# ---- build: ต้องใช้ devDependencies เพื่อคอมไพล์ TypeScript ----
FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- run: เหลือแค่ JavaScript ที่คอมไพล์แล้วกับ dependency ที่ใช้จริง ----
FROM node:24-alpine

RUN apk add --no-cache postgresql16-client

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY sql ./sql

EXPOSE 3000
CMD ["node", "dist/main.js"]
