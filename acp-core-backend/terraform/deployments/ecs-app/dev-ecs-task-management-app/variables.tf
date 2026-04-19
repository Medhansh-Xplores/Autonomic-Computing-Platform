variable "region" {
  description = "AWS region to deploy into"
  type        = string
}

variable "role_arn" {
  description = "IAM role ARN to assume for deployment"
  type        = string
}

# -----------------------------
# Cluster references
# (copy these from: terraform output in your ecs-cluster deployment)
# -----------------------------

variable "cluster_id" {
  description = "ECS cluster ID (from ecs-cluster output)"
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN (from ecs-cluster output)"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group name (from ecs-cluster output)"
  type        = string
}

variable "http_listener_arn" {
  description = "Shared ALB HTTP listener ARN (from ecs-cluster output)"
  type        = string
}

variable "security_group_id" {
  description = "Shared ECS security group ID (from ecs-cluster output)"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs (from ecs-cluster output)"
  type        = list(string)
}

# -----------------------------
# App identity
# -----------------------------

variable "app_name" {
  description = "Short name for this app, used as a resource prefix (e.g. 'payments')"
  type        = string
}

variable "zone_name" {
  description = "Zone/domain prefix used for ECR repository names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID (must match the cluster's VPC)"
  type        = string
}

# -----------------------------
# Container config
# -----------------------------

variable "cpu" {
  description = "Fargate CPU units"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate memory in MB"
  type        = number
  default     = 512
}

variable "container_port" {
  description = "Port the backend container listens on"
  type        = number
  default     = 8080
}

variable "frontend_image_tag" {
  description = "Docker image tag for the frontend container"
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Docker image tag for the backend container"
  type        = string
  default     = "latest"
}

variable "environment_variables" {
  description = "Environment variables injected into the backend container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

# -----------------------------
# ALB routing
# -----------------------------

variable "listener_priority" {
  description = "ALB listener rule priority for backend routes (must be unique across all apps on this ALB)"
  type        = number
}

variable "path_patterns" {
  description = "Path patterns that route to the backend (e.g. [\"/api/*\"])"
  type        = list(string)
}

variable "frontend_listener_priority" {
  description = "ALB listener rule priority for frontend routes (must be unique across all apps on this ALB)"
  type        = number
}

variable "frontend_path_patterns" {
  description = "Path patterns that route to the frontend (e.g. [\"/*\"])"
  type        = list(string)
  default     = ["/*"]
}
