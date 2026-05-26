variable "region" {
  description = "Azure region to deploy into"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "vnet_name" {
  description = "Virtual network name"
  type        = string
}

variable "cidr" {
  description = "Virtual network CIDR block"
  type        = string
}

variable "subnet_name" {
  description = "Default subnet name"
  type        = string
  default     = "default"
}

variable "subnet_cidr" {
  description = "Default subnet CIDR block"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
