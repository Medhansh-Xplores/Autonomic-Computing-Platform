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
  subnets      = var.subnets

  common_tags = {
    CreatedBy  = "Autonomic-Cloud-Platform"
    Platform   = "ACP"
    Deployment = var.cluster_name
    ManagedBy  = "Terraform"
  }
}