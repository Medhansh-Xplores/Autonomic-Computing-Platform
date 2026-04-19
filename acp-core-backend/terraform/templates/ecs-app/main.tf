provider "aws" {
  region = var.region

  assume_role {
    role_arn = var.role_arn
  }
}

module "ecs_app" {
  source = "../../../modules/ecs-app"

  app_name  = var.app_name
  zone_name = var.zone_name
  vpc_id    = var.vpc_id
  region    = var.region

  # Pass cluster values directly as variables
  # (get these from the ecs-cluster deployment outputs)
  cluster_id         = var.cluster_id
  execution_role_arn = var.execution_role_arn
  log_group_name     = var.log_group_name
  http_listener_arn  = var.http_listener_arn
  security_group_id  = var.security_group_id
  private_subnet_ids = var.private_subnet_ids

  # Container config
  cpu            = var.cpu
  memory         = var.memory
  container_port = var.container_port

  # Image tags
  frontend_image_tag = var.frontend_image_tag
  backend_image_tag  = var.backend_image_tag

  # Routing
  listener_priority          = var.listener_priority
  path_patterns              = var.path_patterns
  frontend_listener_priority = var.frontend_listener_priority
  frontend_path_patterns     = var.frontend_path_patterns

  # Env vars
  environment_variables = var.environment_variables

  created_by = "Autonomic Computing Platform"
}
