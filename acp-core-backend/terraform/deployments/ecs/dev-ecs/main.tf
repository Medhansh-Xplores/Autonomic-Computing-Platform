provider "aws" {
  region = var.region

  assume_role {
    role_arn = var.role_arn
  }
}

module "ecs_cluster" {
  source = "../../../modules/ecs"

  cluster_name = var.cluster_name
  vpc_id       = var.vpc_id

  created_by = "Autonomic Computing Platform"
}
