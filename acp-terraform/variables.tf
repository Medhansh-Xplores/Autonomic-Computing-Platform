variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# ── Networking ────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

# ── ECS ───────────────────────────────────────────────────────────────────────

variable "backend_image" {
  description = "Backend ECR image URI — filled by GitHub Actions"
  type        = string
  default     = "node:20-alpine"    # ← was ""
}

variable "frontend_image" {
  description = "Frontend ECR image URI — filled by GitHub Actions"
  type        = string
  default     = "nginx:alpine"      # ← was ""
}

variable "backend_cpu" {
  description = "Backend task CPU units"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Backend task memory (MB)"
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "Frontend task CPU units"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend task memory (MB)"
  type        = number
  default     = 512
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "db_username" {
  default     = "acp_user"
}

variable "db_password" {
  description = "RDS master password — filled by GitHub Actions"
  type        = string
  default     = ""
}

variable "db_name" {
  default     = "acp_portal"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito App Client ID"
  type        = string
}