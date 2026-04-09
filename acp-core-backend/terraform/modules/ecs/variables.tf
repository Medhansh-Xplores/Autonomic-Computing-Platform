variable "cluster_name" {}
variable "region" {}
variable "vpc_id" {}
variable "cpu" {}
variable "memory" {}
variable "zone_name" {}

variable "created_by" {
  type = string
}

variable "frontend_image_tag" {
  default = "latest"
}

variable "backend_image_tag" {
  default = "latest"
}

# -----------------------------
# New Variables (Add Below)
# -----------------------------

variable "container_port" {
  description = "Backend container port"
  type        = number
  default     = 5000
}

variable "listener_priority" {
  description = "ALB listener priority"
  type        = number
  default     = 100
}

variable "path_patterns" {
  description = "ALB path routing"
  type        = list(string)
  default     = ["/api/*"]
}

variable "environment_variables" {
  description = "Container environment variables"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}