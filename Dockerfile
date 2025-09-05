FROM node:24.5.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Только сборка, без nginx
FROM alpine:latest as production
COPY --from=builder /app/dist /dist