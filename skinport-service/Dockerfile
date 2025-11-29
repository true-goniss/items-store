# Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build 

# Run
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist

# env
ENV NODE_ENV=production
ENV PORT=7777

EXPOSE 7777
CMD ["node", "dist/index.js"]