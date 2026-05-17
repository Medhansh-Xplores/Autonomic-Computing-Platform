# Stage 1 — Build Angular app
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build -- --configuration production

# Stage 2 — Serve with nginx (unprivileged)
# nginxinc/nginx-unprivileged runs as UID 101 (non-root)
FROM nginxinc/nginx-unprivileged:alpine

# FIX 1: Switch to root only to clean the default html files,
# then switch back to the unprivileged user (101)
USER root
RUN rm -rf /usr/share/nginx/html/*
USER 101

# Copy built Angular app
COPY --from=builder /app/dist/acp-core-ui /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# FIX 2: unprivileged nginx listens on 8080, not 80
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
