# ---- build: คอมไพล์ Next.js เป็น standalone server ----
FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

# rewrites ของ Next ถูก serialize ลง .next ตอน build — ที่อยู่ API จึงต้องรู้ตั้งแต่ตอนนี้
# ตั้ง env ตอน runtime อย่างเดียวไม่มีผล
ARG API_ORIGIN=http://api:3000
ENV API_ORIGIN=$API_ORIGIN

COPY tsconfig.json next.config.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
RUN npm run build

# ---- run: เหลือเฉพาะ server กับไฟล์คงที่ ----
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 5173
CMD ["node", "server.js"]
