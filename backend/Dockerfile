FROM node:24-alpine

RUN apk add --no-cache git postgresql16-client

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "src/server.js"]
