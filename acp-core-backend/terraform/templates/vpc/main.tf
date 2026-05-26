provider "aws" {
  region = var.region
}

module "vpc" {
  source = "../../../modules/vpc"

  vpc_name = var.vpc_name
  cidr     = var.cidr

  public_subnet_1  = var.public_subnet_1
  public_subnet_2  = var.public_subnet_2
  private_subnet_1 = var.private_subnet_1
  private_subnet_2 = var.private_subnet_2

  az_1 = var.az_1
  az_2 = var.az_2

  common_tags = {
    CreatedBy = "Autonomic Computing Platform"
  }
}