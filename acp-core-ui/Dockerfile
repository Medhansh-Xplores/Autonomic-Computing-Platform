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
# FIX: switched from nginx:alpine to nginx:unprivileged-alpine
# This image runs nginx as UID 101 (non-root) out of the box
# and moves all writable paths to locations a non-root user can access
FROM nginx:alpine-unprivileged

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built Angular app
COPY --from=builder /app/dist/acp-core-ui /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# FIX: nginx:alpine-unprivileged listens on 8080 by default, not 80
# (ports below 1024 require root). Update EXPOSE accordingly.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]