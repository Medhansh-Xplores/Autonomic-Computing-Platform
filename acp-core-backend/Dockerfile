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

# Only deployments dir needs to exist for EFS mount
# (terraform/deployments gets mounted over by EFS at runtime)
RUN mkdir -p /app/deployments

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "src/app.js"]