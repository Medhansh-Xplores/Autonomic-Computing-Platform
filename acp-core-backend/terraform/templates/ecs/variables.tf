variable "cluster_name" {}
variable "region" {}
variable "vpc_id" {}
variable "cpu" {}
variable "memory" {}
variable "zone_name" {}
variable "role_arn" {}

variable "common_tags" {
  type    = map(string)
  default = {}
}

variable "created_by" {
  type    = string
  default = "ACP-Portal"
}

variable "frontend_image_tag" {
  default = "latest"
}

variable "backend_image_tag" {
  default = "latest"
}

# -----------------------------
# Add These New Variables
# -----------------------------

variable "container_port" {
  type    = number
  default = 5000
}

variable "listener_priority" {
  type    = number
  default = 100
}

variable "path_patterns" {
  type    = list(string)
  default = ["/api/*"]
}

variable "environment_variables" {
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}