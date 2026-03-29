variable "vpc_name" {}
variable "cidr" {}
variable "public_subnet" {}
variable "private_subnet" {}
variable "region" {}
variable "az" {}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}