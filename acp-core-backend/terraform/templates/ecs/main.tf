provider "aws" {
  region = var.region
}

module "ecs_cluster" {
  source = "../../../modules/ecs"

  cluster_name = var.cluster_name
  vpc_id       = var.vpc_id
  region       = var.region

  created_by = "Autonomic Computing Platform"
}
