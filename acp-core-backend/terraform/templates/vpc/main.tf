provider "aws" {
  region = var.region

  assume_role {
    role_arn = var.role_arn
  }
}

module "vpc" {
  source = "../../../modules/vpc"

  vpc_name       = var.vpc_name
  cidr           = var.cidr
  public_subnet  = var.public_subnet
  private_subnet = var.private_subnet
  region         = var.region
  az             = var.az

  common_tags = {
    CreatedBy  = "Autonomic Computing Platform"
  }
}