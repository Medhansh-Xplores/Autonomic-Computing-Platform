variable "vpc_id" {
  description = "VPC where the cluster lives"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster (used as a prefix for all shared resources)"
  type        = string
}

variable "created_by" {
  description = "Tag value for CreatedBy"
  type        = string
  default     = "terraform"
}

variable "elb_account_id" {
  description = "AWS ELB service account ID for your region. us-east-1 = 127311923021. Full list: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html"
  type        = string
  default     = "127311923021"
}