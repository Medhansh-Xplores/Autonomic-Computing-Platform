variable "cluster_name" {}
variable "region" {}
variable "vpc_id" {}
variable "cpu" {}
variable "memory" {}
variable "zone_name" {}
variable "role_arn" {}

variable "subnets" {
  type = list(string)
}

variable "common_tags" {
  type = map(string)
}