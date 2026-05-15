FROM node:20-alpine

# Install terraform
RUN apk add --no-cache curl unzip bash && \
    curl -fsSL https://releases.hashicorp.com/terraform/1.7.5/terraform_1.7.5_linux_amd64.zip -o terraform.zip && \
    unzip terraform.zip && \
    mv terraform /usr/local/bin/terraform && \
    rm terraform.zip

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Copy terraform templates into image
COPY terraform/ ./terraform/

# FIX 1: Create the non-root user (UID 1000) before setting permissions
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -S appuser

# FIX 2: Create dirs and give ownership to appuser
# /app/deployments and /app/terraform/deployments will be EFS-mounted at runtime
# but the dirs must exist and be owned by appuser before the mount
RUN mkdir -p /app/deployments /app/terraform/deployments && \
    chown -R appuser:appgroup /app

# FIX 3: Switch to non-root user
USER appuser

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "src/app.js"]