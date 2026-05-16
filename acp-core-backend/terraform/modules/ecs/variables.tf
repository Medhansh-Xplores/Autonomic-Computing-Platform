variable "vpc_id" {
  description = "VPC where the cluster lives"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster (used as a prefix for all shared resources)"
  type        = string
}

variable "region" {
  description = "AWS region to deploy resources into"
  type        = string
}

variable "created_by" {
  description = "Tag value for CreatedBy"
  type        = string
  default     = "terraform"
}
