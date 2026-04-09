variable "cidr" {}
variable "vpc_name" {}

variable "public_subnet_1" {}
variable "public_subnet_2" {}

variable "private_subnet_1" {}
variable "private_subnet_2" {}

variable "az_1" {}
variable "az_2" {}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}