variable "vpc_name" {}
variable "cidr" {}
variable "public_subnet" {}
variable "private_subnet" {}
variable "region" {}
variable "az" {}
variable "role_arn" {}

variable "common_tags" {
  type = map(string)
  default = {}
}