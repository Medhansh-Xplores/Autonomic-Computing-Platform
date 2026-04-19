variable "region" {
  description = "AWS region to deploy into"
  type        = string
}

variable "role_arn" {
  description = "IAM role ARN to assume for deployment"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the cluster will be created"
  type        = string
}

variable "created_by" {
  type    = string
  default = "Autonomic Computing Platform"
}