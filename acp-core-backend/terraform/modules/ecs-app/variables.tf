# ---- Identifiers ----

variable "app_name" {
  description = "Short name for this app, used as a resource prefix (e.g. 'myapp')"
  type        = string
}

variable "zone_name" {
  description = "Zone/domain prefix used for ECR repository names"
  type        = string
}

# ---- Cluster references (outputs from the cluster stack) ----

variable "cluster_id" {
  description = "ECS cluster ID (from cluster stack output: cluster_id)"
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN (from cluster stack output: execution_role_arn)"
  type        = string
}

variable "log_group_name" {
  description = "CloudWatch log group name (from cluster stack output: log_group_name)"
  type        = string
}

variable "http_listener_arn" {
  description = "Shared ALB HTTP listener ARN (from cluster stack output: http_listener_arn)"
  type        = string
}

variable "security_group_id" {
  description = "Shared ECS security group ID (from cluster stack output: security_group_id)"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs (from cluster stack output: private_subnet_ids)"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

# ---- App config ----

variable "region" {
  description = "AWS region"
  type        = string
}

variable "container_port" {
  description = "Port the backend container listens on"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "Fargate CPU units"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate memory (MB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of running tasks for each service"
  type        = number
  default     = 2
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

# ---- Listener rule routing ----

variable "listener_priority" {
  description = "ALB listener rule priority for the backend rule (must be unique across all apps)"
  type        = number
}

variable "path_patterns" {
  description = "Path patterns that route to the backend (e.g. [\"/api/*\"])"
  type        = list(string)
}

variable "frontend_listener_priority" {
  description = "ALB listener rule priority for the frontend rule (must be unique across all apps)"
  type        = number
}

variable "frontend_path_patterns" {
  description = "Path patterns that route to the frontend (e.g. [\"/*\"])"
  type        = list(string)
}

# ---- Tags ----

variable "created_by" {
  description = "Tag value for CreatedBy"
  type        = string
  default     = "terraform"
}
