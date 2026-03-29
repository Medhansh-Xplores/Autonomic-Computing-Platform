variable "cluster_name" {}
variable "region" {}
variable "vpc_id" {}
variable "cpu" {}
variable "memory" {}
variable "zone_name" {}

variable "subnets" {
  type = list(string)
}