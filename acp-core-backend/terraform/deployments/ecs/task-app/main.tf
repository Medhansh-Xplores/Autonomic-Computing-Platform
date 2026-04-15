provider "aws" {
  region = var.region

  assume_role {
    role_arn = var.role_arn
  }
}

module "ecs" {
  source = "../../../modules/ecs"

  cluster_name = var.cluster_name
  region       = var.region
  vpc_id       = var.vpc_id
  cpu          = var.cpu
  memory       = var.memory
  zone_name    = var.zone_name

  frontend_image_tag = var.frontend_image_tag
  backend_image_tag  = var.backend_image_tag

  # -----------------------------
  # New Variables (Add These)
  # -----------------------------

  container_port        = var.container_port
  listener_priority     = var.listener_priority
  path_patterns         = var.path_patterns
  environment_variables = var.environment_variables

  created_by = "Autonomic Computing Platform"
}