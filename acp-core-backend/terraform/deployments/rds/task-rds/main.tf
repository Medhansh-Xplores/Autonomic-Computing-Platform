provider "aws" {
  region = var.region

  assume_role {
    role_arn = var.role_arn
  }
}

# -----------------------------
# Get Subnets from VPC
# -----------------------------

data "aws_subnets" "selected" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
}

# -----------------------------
# RDS Module
# -----------------------------

module "rds" {

  source = "../../../modules/rds"

  rds_identifier = var.rds_identifier

  db_engine = var.db_engine

  db_username = var.db_username
  db_password = var.db_password

  initial_db_name = var.initial_db_name

  vpc_id     = var.vpc_id
  subnet_ids = data.aws_subnets.selected.ids

  db_port = var.db_port


}