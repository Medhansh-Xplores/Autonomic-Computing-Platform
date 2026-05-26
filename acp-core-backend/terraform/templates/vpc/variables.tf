variable "region" {}

variable "vpc_name" {}
variable "cidr" {}

variable "public_subnet_1" {}
variable "public_subnet_2" {}

variable "private_subnet_1" {}
variable "private_subnet_2" {}

variable "az_1" {}
variable "az_2" {}

variable "common_tags" {
  type = map(string)
  default = {}
}

variable "created_by" {
  type = string
  default = "ACP-Portal"
}