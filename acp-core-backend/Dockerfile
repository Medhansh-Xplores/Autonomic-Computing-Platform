FROM node:20-alpine

# Install terraform so the backend can run terraform commands
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

# These dirs are mounted via EFS in ECS at runtime
# Creating them here just ensures the paths exist if EFS isn't mounted
RUN mkdir -p /app/deployments \
    /app/terraform/deployments \
    /app/terraform/templates

EXPOSE 8080

ENV NODE_ENV=production

CMD ["node", "src/app.js"]