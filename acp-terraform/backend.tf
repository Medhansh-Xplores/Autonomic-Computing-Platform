terraform {
  backend "s3" {
    bucket  = "acp-portal-tfstate"
    key     = "acp-portal/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.7.0"
}

provider "aws" {
  region = var.aws_region
}